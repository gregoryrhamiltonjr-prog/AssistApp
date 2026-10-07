import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import {
  mkdirSync,
  chmodSync,
  existsSync,
  readFileSync,
  writeFileSync,
  lstatSync,
} from "node:fs";
import { dirname } from "node:path";
import { schemas, tools, settingsSchema } from "./domain.js";

export class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const now = () => new Date().toISOString();
const hash = (v) => createHash("sha256").update(v).digest("hex");
export class Store {
  constructor(path) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      if (existsSync(path) && lstatSync(path).isSymbolicLink())
        throw new Error("Refusing a symlink database.");
    }
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(
      `PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;`,
    );
    const version = this.db.prepare("PRAGMA user_version").get().user_version;
    if (version > 2)
      throw new Error("Database version is newer than this app.");
    if (path === ":memory:") this.key = randomBytes(32);
    else {
      const keyPath = path + ".key";
      if (existsSync(keyPath)) {
        if (lstatSync(keyPath).isSymbolicLink())
          throw new Error("Refusing a symlink encryption key.");
        this.key = readFileSync(keyPath);
        chmodSync(keyPath, 0o600);
      } else {
        if (version === 2)
          throw new Error(
            "Encryption key is missing. Restore the original .key file; do not replace it.",
          );
        this.key = randomBytes(32);
        writeFileSync(keyPath, this.key, { mode: 0o600, flag: "wx" });
      }
      if (this.key.length !== 32)
        throw new Error("Encryption key must be 32 bytes.");
    }
    if (version === 0)
      this.db.exec(`BEGIN;
   CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,salt TEXT NOT NULL,settings TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
   CREATE TABLE records(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,provenance TEXT NOT NULL);
   CREATE INDEX records_owner_kind ON records(owner_id,kind);
   CREATE TABLE actions(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,tool TEXT NOT NULL,input TEXT NOT NULL,status TEXT NOT NULL,result TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE INDEX actions_owner_time ON actions(owner_id,created_at);
   CREATE TABLE messages(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL);
   PRAGMA user_version=1; COMMIT;`);
    if (version < 2)
      this.transaction(() => {
        for (const row of this.db.prepare("SELECT * FROM users").all())
          this.db
            .prepare("UPDATE users SET email=?,settings=? WHERE id=?")
            .run(
              this.emailIndex(row.email),
              this.seal({ ...JSON.parse(row.settings), email: row.email }),
              row.id,
            );
        for (const row of this.db.prepare("SELECT * FROM records").all())
          this.db
            .prepare("UPDATE records SET data=? WHERE id=?")
            .run(this.seal(JSON.parse(row.data)), row.id);
        for (const row of this.db.prepare("SELECT * FROM actions").all())
          this.db
            .prepare("UPDATE actions SET input=?,result=?,error=? WHERE id=?")
            .run(
              this.seal(JSON.parse(row.input)),
              row.result ? this.seal(JSON.parse(row.result)) : null,
              row.error ? this.seal(row.error) : null,
              row.id,
            );
        for (const row of this.db.prepare("SELECT * FROM messages").all())
          this.db
            .prepare("UPDATE messages SET text=? WHERE id=?")
            .run(this.seal(row.text), row.id);
        this.db.exec("PRAGMA user_version=2");
      });
    const existing = this.db
      .prepare("SELECT settings FROM users LIMIT 1")
      .get();
    if (existing) this.open(existing.settings);
  }
  seal(value) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return [
      "enc",
      "v1",
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      encrypted.toString("base64"),
    ].join(":");
  }
  open(value) {
    const [prefix, version, iv, tag, data] = value.split(":");
    if (prefix !== "enc" || version !== "v1")
      throw new Error("Unsupported encrypted payload.");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(data, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    );
  }
  emailIndex(value) {
    return createHmac("sha256", this.key)
      .update(value.toLowerCase())
      .digest("hex");
  }
  close() {
    this.db.close();
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  register({ email, password, name, timezone }) {
    const settings = settingsSchema.parse({
      name,
      timezone,
      autonomy: "approval",
      memoryEnabled: true,
    });
    if (
      this.db
        .prepare("SELECT id FROM users WHERE email=?")
        .get(this.emailIndex(email))
    )
      throw new Problem(409, "An account already uses this email.");
    const id = randomUUID(),
      salt = randomBytes(32).toString("hex");
    const digest = scryptSync(password, salt, 64).toString("hex");
    this.db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?,?)")
      .run(
        id,
        this.emailIndex(email),
        digest,
        salt,
        this.seal({ ...settings, email }),
        now(),
      );
    return this.user(id);
  }
  login(email, password) {
    const row = this.db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(this.emailIndex(email));
    const salt = row?.salt ?? "constant-timing-salt";
    const digest = scryptSync(password, salt, 64);
    if (!row || !timingSafeEqual(digest, Buffer.from(row.password, "hex")))
      throw new Problem(401, "Email or password is incorrect.");
    return this.user(row.id);
  }
  session(id) {
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(hash(token), id, Date.now() + 7 * 86400000);
    return token;
  }
  sessionUser(token) {
    if (!token) return null;
    const row = this.db
      .prepare(
        "SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?",
      )
      .get(hash(token), Date.now());
    return row ? this.user(row.user_id) : null;
  }
  logout(token) {
    if (token)
      this.db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(hash(token));
  }
  user(id) {
    const row = this.db
      .prepare("SELECT id,settings FROM users WHERE id=?")
      .get(id);
    return row ? { id: row.id, ...this.open(row.settings) } : null;
  }
  setSettings(id, settings) {
    const parsed = settingsSchema.parse(settings);
    this.db
      .prepare("UPDATE users SET settings=? WHERE id=?")
      .run(this.seal({ ...parsed, email: this.user(id).email }), id);
    return this.user(id);
  }
  decode(row) {
    return row
      ? {
          id: row.id,
          kind: row.kind,
          data: this.open(row.data),
          revision: row.revision,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          provenance: row.provenance,
          syncState: "local",
        }
      : null;
  }
  list(owner) {
    return this.db
      .prepare(
        "SELECT * FROM records WHERE owner_id=? ORDER BY created_at DESC",
      )
      .all(owner)
      .map((x) => this.decode(x));
  }
  record(owner, id) {
    const row = this.db
      .prepare("SELECT * FROM records WHERE owner_id=? AND id=?")
      .get(owner, id);
    if (!row) throw new Problem(404, "This record is no longer available.");
    return this.decode(row);
  }
  validateRelationships(owner, kind, data) {
    for (const [field, target] of [
      ["personId", "people"],
      ["tripId", "trips"],
    ])
      if (data[field]) {
        const related = this.record(owner, data[field]);
        if (related.kind !== target)
          throw new Problem(400, "Invalid related record.");
      }
  }
  create(owner, kind, input, provenance = "user") {
    if (!schemas[kind]) throw new Problem(400, "Unknown workspace.");
    const data = schemas[kind].parse(input);
    this.validateRelationships(owner, kind, data);
    const id = randomUUID(),
      stamp = now();
    this.db
      .prepare("INSERT INTO records VALUES(?,?,?,?,1,?,?,?)")
      .run(id, owner, kind, this.seal(data), stamp, stamp, provenance);
    return this.record(owner, id);
  }
  update(owner, id, input, revision) {
    const current = this.record(owner, id);
    const data = schemas[current.kind].parse(input);
    this.validateRelationships(owner, current.kind, data);
    const r = this.db
      .prepare(
        "UPDATE records SET data=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?",
      )
      .run(this.seal(data), now(), id, owner, revision);
    if (!r.changes)
      throw new Problem(
        409,
        "This item changed since you opened it. Refresh before trying again.",
      );
    return this.record(owner, id);
  }
  remove(owner, id, revision) {
    this.record(owner, id);
    const related = this.list(owner).some(
      (r) => r.data.personId === id || r.data.tripId === id,
    );
    if (related)
      throw new Problem(
        409,
        "Remove linked reminders or events before deleting this item.",
      );
    const r = this.db
      .prepare("DELETE FROM records WHERE id=? AND owner_id=? AND revision=?")
      .run(id, owner, revision);
    if (!r.changes)
      throw new Problem(409, "This item changed. Refresh before deleting.");
  }
  action(row) {
    return row
      ? {
          id: row.id,
          tool: row.tool,
          input: this.open(row.input),
          status: row.status,
          result: row.result ? this.open(row.result) : null,
          error: row.error ? this.open(row.error) : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }
  actions(owner) {
    return this.db
      .prepare(
        "SELECT * FROM actions WHERE owner_id=? ORDER BY created_at DESC LIMIT 200",
      )
      .all(owner)
      .map((x) => this.action(x));
  }
  readTool(owner, tool, input) {
    if (!tools[tool]?.read)
      throw new Problem(400, "Unsupported read operation.");
    const parsed = tools[tool].input.parse(input),
      kind =
        tool === "search_tasks"
          ? "tasks"
          : tool === "search_events"
            ? "events"
            : "people";
    const result = tools[tool].output.parse({
      records: this.list(owner)
        .filter(
          (r) =>
            r.kind === kind &&
            r.data.title.toLowerCase().includes(parsed.query.toLowerCase()),
        )
        .slice(0, 50),
      scope: tools[tool].scope,
    });
    const id = randomUUID(),
      stamp = now();
    this.db
      .prepare("INSERT INTO actions VALUES(?,?,?,?,?,?,NULL,?,?)")
      .run(
        id,
        owner,
        tool,
        this.seal(parsed),
        "completed",
        this.seal(result),
        stamp,
        stamp,
      );
    return this.action(
      this.db.prepare("SELECT * FROM actions WHERE id=?").get(id),
    );
  }
  propose(owner, tool, input) {
    if (!tools[tool] || tools[tool].read)
      throw new Problem(400, "Unsupported assistant mutation.");
    if (this.user(owner).autonomy === "observe")
      throw new Problem(403, "Observe mode cannot prepare changes.");
    const parsed = tools[tool].input.parse(input);
    if (parsed.id) {
      const r = this.record(owner, parsed.id);
      if (r.revision !== parsed.revision)
        throw new Problem(
          409,
          "This item changed before the proposal was prepared.",
        );
      if (r.kind !== (tool.includes("event") ? "events" : "tasks"))
        throw new Problem(400, "The action targets the wrong workspace.");
    }
    const id = randomUUID(),
      stamp = now();
    this.db
      .prepare("INSERT INTO actions VALUES(?,?,?,?,?,NULL,NULL,?,?)")
      .run(id, owner, tool, this.seal(parsed), "proposed", stamp, stamp);
    return this.action(
      this.db
        .prepare("SELECT * FROM actions WHERE id=? AND owner_id=?")
        .get(id, owner),
    );
  }
  execute(owner, id, approved = false) {
    const row = this.db
      .prepare("SELECT * FROM actions WHERE id=? AND owner_id=?")
      .get(id, owner);
    if (!row) throw new Problem(404, "Action not found.");
    const action = this.action(row);
    if (action.status === "completed") return action;
    if (action.status !== "proposed")
      throw new Problem(409, "This action is no longer awaiting approval.");
    const mode = this.user(owner).autonomy;
    if (["observe", "suggest"].includes(mode))
      throw new Problem(
        403,
        "Your current assistant mode does not allow execution.",
      );
    const autopilot =
      mode === "autopilot" &&
      ["create_task", "complete_task"].includes(action.tool);
    if (!approved && !autopilot)
      throw new Problem(403, "Explicit approval is required.");
    try {
      return this.transaction(() => {
        const input = tools[action.tool].input.parse(action.input);
        let result;
        if (action.tool === "create_task")
          result = this.create(owner, "tasks", { ...input }, "assistant");
        if (action.tool === "create_event")
          result = this.create(owner, "events", { ...input }, "assistant");
        if (
          ["complete_task", "reschedule_task", "reschedule_event"].includes(
            action.tool,
          )
        ) {
          const current = this.record(owner, input.id);
          const patch =
            action.tool === "complete_task"
              ? { status: "completed" }
              : action.tool === "reschedule_task"
                ? { due: input.due }
                : { start: input.start, end: input.end };
          result = this.update(
            owner,
            input.id,
            { ...current.data, ...patch },
            input.revision,
          );
        }
        if (!result) throw new Problem(400, "Unsupported execution.");
        const verified = tools[action.tool].output.parse({
          record: result,
          scope: tools[action.tool].scope,
        });
        this.db
          .prepare(
            "UPDATE actions SET status='completed',result=?,updated_at=? WHERE id=? AND owner_id=?",
          )
          .run(this.seal(verified), now(), id, owner);
        return this.action(
          this.db
            .prepare("SELECT * FROM actions WHERE id=? AND owner_id=?")
            .get(id, owner),
        );
      });
    } catch (e) {
      this.db
        .prepare(
          "UPDATE actions SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=?",
        )
        .run(this.seal(e.message), now(), id, owner);
      throw e;
    }
  }
  reject(owner, id) {
    const r = this.db
      .prepare(
        "UPDATE actions SET status='dismissed',updated_at=? WHERE id=? AND owner_id=? AND status='proposed'",
      )
      .run(now(), id, owner);
    if (!r.changes) throw new Problem(409, "This action is no longer pending.");
  }
  message(owner, role, text) {
    this.db
      .prepare("INSERT INTO messages VALUES(?,?,?,?,?)")
      .run(randomUUID(), owner, role, this.seal(text.slice(0, 10000)), now());
  }
  messages(owner) {
    return this.db
      .prepare(
        "SELECT id,role,text,created_at AS createdAt FROM messages WHERE owner_id=? ORDER BY rowid DESC LIMIT 100",
      )
      .all(owner)
      .reverse()
      .map((row) => ({ ...row, text: this.open(row.text) }));
  }
  export(owner) {
    return {
      version: 1,
      exportedAt: now(),
      user: this.user(owner),
      records: this.list(owner),
      actions: this.actions(owner),
      messages: this.messages(owner),
    };
  }
  deleteAccount(owner) {
    this.db.prepare("DELETE FROM users WHERE id=?").run(owner);
  }
}
