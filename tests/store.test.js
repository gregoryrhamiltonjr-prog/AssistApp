import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  statSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.js";
const newUser = (store, email = "one@example.com") =>
  store.register({
    email,
    password: "a-test-password-123!",
    name: "Taylor",
    timezone: "America/New_York",
  });
test("records and sessions survive database restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "steward-")),
    file = join(dir, "db.sqlite");
  let s = new Store(file);
  const user = newUser(s),
    record = s.create(user.id, "tasks", { title: "Persistent task" }),
    token = s.session(user.id);
  s.close();
  s = new Store(file);
  assert.equal(s.record(user.id, record.id).data.title, "Persistent task");
  assert.equal(s.sessionUser(token).id, user.id);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  s.close();
  rmSync(dir, { recursive: true });
});
test("user isolation covers records, sessions and cross-owner relationships", () => {
  const s = new Store(":memory:"),
    a = newUser(s),
    b = newUser(s, "two@example.com"),
    person = s.create(a.id, "people", { title: "Private contact" });
  assert.throws(() => s.record(b.id, person.id), /no longer available/);
  assert.throws(() =>
    s.create(b.id, "tasks", { title: "Reach out", personId: person.id }),
  );
  assert.equal(s.list(b.id).length, 0);
  assert.equal(s.sessionUser("not-a-session"), null);
  s.close();
});
test("stale edits fail without overwriting newer changes", () => {
  const s = new Store(":memory:"),
    u = newUser(s),
    r = s.create(u.id, "tasks", { title: "Original" });
  s.update(u.id, r.id, { ...r.data, title: "Newer" }, r.revision);
  assert.throws(
    () => s.update(u.id, r.id, { ...r.data, title: "Stale" }, r.revision),
    /changed/,
  );
  assert.equal(s.record(u.id, r.id).data.title, "Newer");
  s.close();
});
test("assistant approval is idempotent and uses a verified record", () => {
  const s = new Store(":memory:"),
    u = newUser(s);
  const a = s.propose(u.id, "create_task", {
    title: "One reminder",
    due: null,
  });
  assert.equal(s.list(u.id).length, 0);
  assert.throws(() => s.execute(u.id, a.id, false), /approval/);
  const done = s.execute(u.id, a.id, true);
  assert.equal(done.status, "completed");
  assert.equal(done.result.record.data.title, "One reminder");
  assert.equal(
    s.execute(u.id, a.id, true).result.record.id,
    done.result.record.id,
  );
  assert.equal(s.list(u.id).length, 1);
  s.close();
});
test("observe and suggest modes enforce permissions at execution time", () => {
  const s = new Store(":memory:"),
    u = newUser(s),
    a = s.propose(u.id, "create_task", { title: "Approval", due: null });
  s.setSettings(u.id, {
    name: u.name,
    timezone: u.timezone,
    autonomy: "suggest",
    memoryEnabled: false,
  });
  assert.throws(() => s.execute(u.id, a.id, true), /does not allow/);
  s.setSettings(u.id, {
    name: u.name,
    timezone: u.timezone,
    autonomy: "observe",
    memoryEnabled: false,
  });
  assert.throws(
    () => s.propose(u.id, "create_task", { title: "No", due: null }),
    /Observe/,
  );
  assert.equal(s.list(u.id).length, 0);
  assert.equal(
    s.readTool(u.id, "search_tasks", { query: "" }).status,
    "completed",
  );
  s.close();
});
test("limited autopilot allows only preapproved reminder operations", () => {
  const s = new Store(":memory:"),
    u = newUser(s);
  s.setSettings(u.id, {
    name: u.name,
    timezone: u.timezone,
    autonomy: "autopilot",
    memoryEnabled: true,
  });
  const task = s.propose(u.id, "create_task", { title: "Auto", due: null });
  assert.equal(s.execute(u.id, task.id, false).status, "completed");
  const event = s.propose(u.id, "create_event", {
    title: "Approval needed",
    start: "2026-10-07T13:00:00Z",
    end: "2026-10-07T14:00:00Z",
    timezone: u.timezone,
  });
  assert.throws(() => s.execute(u.id, event.id, false), /approval/);
  s.close();
});
test("stale proposals fail, are audited, and are not retried", () => {
  const s = new Store(":memory:"),
    u = newUser(s),
    r = s.create(u.id, "tasks", { title: "Task" }),
    a = s.propose(u.id, "complete_task", { id: r.id, revision: 1 });
  s.update(u.id, r.id, { ...r.data, title: "Changed" }, 1);
  assert.throws(() => s.execute(u.id, a.id, true), /changed/);
  assert.equal(s.actions(u.id)[0].status, "failed");
  assert.equal(s.record(u.id, r.id).data.status, "open");
  assert.throws(() => s.execute(u.id, a.id, true), /no longer awaiting/);
  s.close();
});
test("unsupported tools and other owners cannot execute actions", () => {
  const s = new Store(":memory:"),
    a = newUser(s),
    b = newUser(s, "two@example.com");
  assert.throws(() => s.propose(a.id, "send_money", { amount: 100 }));
  const proposal = s.propose(a.id, "create_task", {
    title: "Private",
    due: null,
  });
  assert.throws(() => s.execute(b.id, proposal.id, true), /not found/);
  s.reject(a.id, proposal.id);
  assert.throws(() => s.execute(a.id, proposal.id, true), /no longer awaiting/);
  s.close();
});
test("transaction rollback preserves all items on partial failure", () => {
  const s = new Store(":memory:"),
    u = newUser(s),
    one = s.create(u.id, "tasks", { title: "One" }),
    two = s.create(u.id, "tasks", { title: "Two" });
  s.update(u.id, two.id, { ...two.data, title: "Updated two" }, 1);
  assert.throws(() =>
    s.transaction(() => {
      s.update(u.id, one.id, { ...one.data, status: "completed" }, 1);
      s.update(u.id, two.id, { ...two.data, status: "completed" }, 1);
    }),
  );
  assert.equal(s.record(u.id, one.id).data.status, "open");
  s.close();
});
test("account deletion cascades across sessions, messages and actions", () => {
  const s = new Store(":memory:"),
    u = newUser(s),
    token = s.session(u.id);
  s.create(u.id, "tasks", { title: "Task" });
  s.message(u.id, "user", "hello");
  s.propose(u.id, "create_task", { title: "Task two", due: null });
  s.deleteAccount(u.id);
  assert.equal(s.sessionUser(token), null);
  assert.equal(s.list(u.id).length, 0);
  assert.equal(s.actions(u.id).length, 0);
  assert.equal(s.messages(u.id).length, 0);
  s.close();
});
test("private payloads and account emails are encrypted at rest", () => {
  const dir = mkdtempSync(join(tmpdir(), "steward-")),
    file = join(dir, "db.sqlite"),
    s = new Store(file),
    u = newUser(s, "unique-secret-email@example.com");
  s.create(u.id, "tasks", {
    title: "unique-secret-title",
    notes: "unique-secret-note",
  });
  s.message(u.id, "user", "unique-secret-message");
  assert.ok(
    s.db.prepare("SELECT data FROM records").get().data.startsWith("enc:v1:"),
  );
  assert.equal(statSync(file + ".key").mode & 0o777, 0o600);
  s.close();
  const raw = readFileSync(file).toString("latin1");
  for (const value of [
    "unique-secret-email",
    "unique-secret-title",
    "unique-secret-note",
    "unique-secret-message",
  ])
    assert.ok(!raw.includes(value));
  rmSync(dir, { recursive: true });
});
test("missing encryption keys fail closed instead of replacing existing keys", () => {
  const dir = mkdtempSync(join(tmpdir(), "steward-")),
    file = join(dir, "db.sqlite"),
    s = new Store(file);
  newUser(s);
  s.close();
  unlinkSync(file + ".key");
  assert.throws(() => new Store(file), /Encryption key is missing/);
  rmSync(dir, { recursive: true });
});
test("AES-GCM detects payload tampering", () => {
  const s = new Store(":memory:"),
    u = newUser(s),
    r = s.create(u.id, "tasks", { title: "Private" }),
    sealed = s.db.prepare("SELECT data FROM records WHERE id=?").get(r.id).data;
  const parts = sealed.split(":");
  const bytes = Buffer.from(parts[4], "base64");
  bytes[0] ^= 1;
  parts[4] = bytes.toString("base64");
  s.db
    .prepare("UPDATE records SET data=? WHERE id=?")
    .run(parts.join(":"), r.id);
  assert.throws(() => s.record(u.id, r.id));
  s.close();
});
test("version 1 migration preserves records, relationships, sessions and credentials", () => {
  const dir = mkdtempSync(join(tmpdir(), "steward-")),
    file = join(dir, "db.sqlite");
  let s = new Store(file);
  const user = newUser(s),
    person = s.create(user.id, "people", { title: "Legacy person" }),
    task = s.create(user.id, "tasks", {
      title: "Legacy reminder",
      personId: person.id,
    }),
    token = s.session(user.id);
  s.message(user.id, "user", "Legacy conversation");
  s.propose(user.id, "create_task", {
    title: "Legacy pending proposal",
    due: null,
  });
  // Reconstruct the documented version 1 plaintext representation of the same rows.
  for (const r of s.list(user.id))
    s.db
      .prepare("UPDATE records SET data=? WHERE id=?")
      .run(JSON.stringify(r.data), r.id);
  for (const a of s.actions(user.id))
    s.db
      .prepare("UPDATE actions SET input=?,result=?,error=? WHERE id=?")
      .run(
        JSON.stringify(a.input),
        a.result ? JSON.stringify(a.result) : null,
        a.error,
        a.id,
      );
  for (const m of s.messages(user.id))
    s.db.prepare("UPDATE messages SET text=? WHERE id=?").run(m.text, m.id);
  s.db
    .prepare("UPDATE users SET email=?,settings=? WHERE id=?")
    .run(
      user.email,
      JSON.stringify({
        name: user.name,
        timezone: user.timezone,
        autonomy: user.autonomy,
        memoryEnabled: user.memoryEnabled,
      }),
      user.id,
    );
  s.db.exec("PRAGMA user_version=1");
  s.close();
  unlinkSync(file + ".key");
  s = new Store(file);
  assert.equal(s.db.prepare("PRAGMA user_version").get().user_version, 2);
  assert.equal(s.login(user.email, "a-test-password-123!").id, user.id);
  assert.equal(s.sessionUser(token).id, user.id);
  assert.equal(s.record(user.id, task.id).data.personId, person.id);
  assert.equal(s.messages(user.id)[0].text, "Legacy conversation");
  assert.equal(s.actions(user.id)[0].status, "proposed");
  assert.ok(
    s.db
      .prepare("SELECT data FROM records LIMIT 1")
      .get()
      .data.startsWith("enc:v1:"),
  );
  s.close();
  rmSync(dir, { recursive: true });
});
