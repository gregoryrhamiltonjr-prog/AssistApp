import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { Store, Problem } from "./store.js";
import { assist } from "./assistant.js";
import { conflicts, localInstant } from "./domain.js";

const credentials = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
const signup = credentials
  .extend({ name: z.string().trim().min(1).max(80), timezone: z.string() })
  .strict();
const uuid = z.string().uuid();
export function createApp({
  database = "data/steward.sqlite",
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL,
  aiBlockedReason = null,
  production = false,
  trustProxy = false,
} = {}) {
  const app = express(),
    store = new Store(database),
    failures = new Map();
  const aiStatus = {
    aiConfigured: !!apiKey,
    aiAvailable: !!apiKey && !aiBlockedReason,
    aiBlockedReason: apiKey ? aiBlockedReason : null,
  };
  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:"],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method)) {
      if (req.get("X-Steward-Request") !== "1")
        return next(new Problem(403, "This request was not made by Steward."));
      const origin = req.get("origin");
      if (origin && origin !== `${req.protocol}://${req.get("host")}`)
        return next(new Problem(403, "Cross-origin changes are not allowed."));
    }
    const cookies = (req.headers.cookie ?? "").split(";").map((x) => x.trim());
    req.sessionToken = cookies
      .find((x) => x.startsWith("steward_session="))
      ?.slice(16);
    req.user = store.sessionUser(req.sessionToken);
    next();
  });
  app.get("/api/session", (req, res) =>
    res.json({ user: req.user, ...aiStatus }),
  );
  function cookie(req, res, user) {
    res.cookie("steward_session", store.session(user.id), {
      httpOnly: true,
      sameSite: "strict",
      secure: production && req.secure,
      maxAge: 7 * 86400000,
      path: "/",
    });
  }
  for (const route of ["register", "login"])
    app.post(`/api/auth/${route}`, (req, res, next) => {
      try {
        const ip = req.ip,
          entry = failures.get(ip);
        if (entry && entry.count >= 8 && Date.now() - entry.time < 600000)
          throw new Problem(
            429,
            "Too many attempts. Try again in ten minutes.",
          );
        const data = (route === "register" ? signup : credentials).parse(
          req.body,
        );
        const user =
          route === "register"
            ? store.register(data)
            : store.login(data.email, data.password);
        cookie(req, res, user);
        failures.delete(ip);
        res.json({ user, ...aiStatus });
      } catch (e) {
        if (e.status !== 429) {
          if (failures.size > 1000) failures.clear();
          const entry = failures.get(req.ip);
          failures.set(req.ip, {
            count: (entry?.count ?? 0) + 1,
            time: Date.now(),
          });
        }
        next(e);
      }
    });
  app.use("/api", (req, res, next) => {
    if (!req.user)
      return next(new Problem(401, "Sign in to access your workspace."));
    next();
  });
  app.post("/api/auth/logout", (req, res) => {
    store.logout(req.sessionToken);
    res.clearCookie("steward_session");
    res.json({ ok: true });
  });
  app.get("/api/state", (req, res) => {
    const records = store.list(req.user.id);
    res.json({
      user: req.user,
      records,
      actions: store.actions(req.user.id),
      messages: store.messages(req.user.id),
      conflicts: conflicts(records),
      ...aiStatus,
      sync: { state: "local", lastRead: new Date().toISOString() },
    });
  });
  app.post("/api/records/:kind", (req, res, next) => {
    try {
      res
        .status(201)
        .json(store.create(req.user.id, req.params.kind, req.body));
    } catch (e) {
      next(e);
    }
  });
  app.patch("/api/records/:id", (req, res, next) => {
    try {
      uuid.parse(req.params.id);
      const { data, revision } = z
        .object({
          data: z.record(z.unknown()),
          revision: z.number().int().positive(),
        })
        .strict()
        .parse(req.body);
      res.json(store.update(req.user.id, req.params.id, data, revision));
    } catch (e) {
      next(e);
    }
  });
  app.delete("/api/records/:id", (req, res, next) => {
    try {
      uuid.parse(req.params.id);
      const { revision } = z
        .object({ revision: z.number().int().positive() })
        .strict()
        .parse(req.body);
      store.remove(req.user.id, req.params.id, revision);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/triage", (req, res, next) => {
    try {
      const input = z
        .object({
          items: z
            .array(
              z.object({ id: uuid, revision: z.number().int().positive() }),
            )
            .min(1)
            .max(100),
          operation: z.enum(["complete", "reschedule"]),
          due: z.string().datetime({ offset: true }).optional(),
        })
        .strict()
        .parse(req.body);
      if (input.operation === "reschedule" && !input.due)
        throw new Problem(400, "Choose a new deadline.");
      const records = store.transaction(() =>
        input.items.map((item) => {
          const current = store.record(req.user.id, item.id);
          if (current.kind !== "tasks")
            throw new Problem(400, "Only reminders can be triaged.");
          return store.update(
            req.user.id,
            item.id,
            {
              ...current.data,
              ...(input.operation === "complete"
                ? { status: "completed" }
                : { due: input.due }),
            },
            item.revision,
          );
        }),
      );
      res.json({ records });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/local-time", (req, res, next) => {
    try {
      const input = z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          time: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .strict()
        .parse(req.body);
      res.json({
        instant: localInstant(input.date, input.time, req.user.timezone),
      });
    } catch (e) {
      next(new Problem(400, e.message));
    }
  });
  app.post("/api/assistant", async (req, res, next) => {
    const controller = new AbortController();
    req.on("aborted", () => controller.abort());
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      const input = z
        .object({ text: z.string().trim().min(1).max(3000) })
        .strict()
        .parse(req.body);
      res.json(
        await assist(store, req.user, input.text, {
          apiKey: aiStatus.aiAvailable ? apiKey : undefined,
          model,
          signal: controller.signal,
        }),
      );
    } catch (e) {
      if (!res.destroyed) next(e);
    }
  });
  app.post("/api/actions/:id/approve", (req, res, next) => {
    try {
      uuid.parse(req.params.id);
      res.json(store.execute(req.user.id, req.params.id, true));
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/actions/:id/dismiss", (req, res, next) => {
    try {
      store.reject(req.user.id, uuid.parse(req.params.id));
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/settings", (req, res, next) => {
    try {
      res.json(store.setSettings(req.user.id, req.body));
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/export", (req, res) => {
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="steward-export.json"',
    );
    res.json(store.export(req.user.id));
  });
  app.delete("/api/account", (req, res, next) => {
    try {
      const { password } = z
        .object({ password: z.string().min(1).max(128) })
        .strict()
        .parse(req.body);
      store.login(req.user.email, password);
      store.deleteAccount(req.user.id);
      res.clearCookie("steward_session");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/automations/:id/run", (req, res, next) => {
    try {
      const record = store.record(req.user.id, uuid.parse(req.params.id));
      if (record.kind !== "automations")
        throw new Problem(400, "Not an automation.");
      if (!record.data.enabled)
        throw new Problem(409, "This automation is paused.");
      const items = store.list(req.user.id);
      const overdue = items.filter(
        (x) =>
          x.kind === "tasks" &&
          x.data.status === "open" &&
          x.data.due &&
          Date.parse(x.data.due) < Date.now(),
      );
      const text =
        record.data.action === "suggest_triage"
          ? `${overdue.length} overdue reminders need review. Open Today to complete or reschedule them.`
          : `${items.filter((x) => x.kind === "tasks" && x.data.status === "open").length} open reminders and ${items.filter((x) => x.kind === "events").length} saved events. Open Today for your current schedule.`;
      store.message(
        req.user.id,
        "assistant",
        `Dry run · ${record.data.title}: ${text} No changes executed.`,
      );
      res.json({ dryRun: true, text, executed: 0 });
    } catch (e) {
      next(e);
    }
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "This operation is not supported." }),
  );
  app.use((err, req, res, next) => {
    const status = err instanceof z.ZodError ? 400 : (err.status ?? 500);
    const error =
      err instanceof z.ZodError
        ? err.issues
            .map((x) => `${x.path.join(".") || "Input"}: ${x.message}`)
            .join("; ")
        : status === 500
          ? "The workspace could not complete this request. Try again."
          : err.message;
    if (status >= 500)
      console.error("Request failed", {
        path: req.path,
        status,
        code: err.code ?? err.name,
      });
    res.status(status).json({ error });
  });
  return { app, store };
}
