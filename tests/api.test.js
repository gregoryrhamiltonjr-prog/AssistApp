import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { assist } from "../server/assistant.js";
async function fixture(options = {}) {
  const { app, store } = createApp({
    database: ":memory:",
    apiKey: "",
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const request = async (path, method = "GET", body, headers = {}) => {
    const res = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Steward-Request": "1",
        Cookie: cookie,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.headers.get("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    return { status: res.status, body: await res.json() };
  };
  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  };
  return { request, close, store };
}
const registration = {
  name: "Taylor",
  email: "test@example.com",
  password: "a-test-password-123!",
  timezone: "America/New_York",
};
test("a configured key with blocked network retains local commands without exposing credentials", async () => {
  const key = "test-not-a-real-key";
  const f = await fixture({
    apiKey: key,
    aiBlockedReason: "Network access is blocked.",
  });
  try {
    const session = await f.request("/session");
    assert.equal(session.body.aiConfigured, true);
    assert.equal(session.body.aiAvailable, false);
    assert.equal(session.body.aiBlockedReason, "Network access is blocked.");
    assert.equal(JSON.stringify(session.body).includes(key), false);
    await f.request("/auth/register", "POST", registration);
    const result = await f.request("/assistant", "POST", {
      text: "Remind me to test configuration tomorrow",
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.engine, "local");
    assert.equal(result.body.actions.length, 1);
    assert.equal(result.body.actions[0].status, "proposed");
    const state = await f.request("/state");
    assert.equal(state.body.aiConfigured, true);
    assert.equal(state.body.aiAvailable, false);
    assert.equal(JSON.stringify(state.body).includes(key), false);
  } finally {
    await f.close();
  }
});
test("authenticated reminder journey persists across state reads", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("/state")).status, 401);
    assert.equal(
      (await f.request("/auth/register", "POST", registration)).status,
      200,
    );
    const r = await f.request("/records/tasks", "POST", {
      title: "Buy groceries",
    });
    assert.equal(r.status, 201);
    const update = await f.request("/records/" + r.body.id, "PATCH", {
      data: { ...r.body.data, status: "completed" },
      revision: 1,
    });
    assert.equal(update.status, 200);
    const state = await f.request("/state");
    assert.equal(state.body.records[0].data.status, "completed");
    assert.equal((await f.request("/export")).body.records.length, 1);
    assert.equal((await f.request("/auth/logout", "POST", {})).status, 200);
    assert.equal((await f.request("/state")).status, 401);
  } finally {
    await f.close();
  }
});
test("CSRF headers, strict validation and stale requests are enforced", async () => {
  const f = await fixture();
  try {
    await f.request("/auth/register", "POST", registration);
    assert.equal(
      (
        await f.request(
          "/records/tasks",
          "POST",
          { title: "Forged" },
          { "X-Steward-Request": "" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/records/tasks",
          "POST",
          { title: "Forged" },
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("/records/tasks", "POST", {
          title: "Task",
          confirmed: true,
        })
      ).status,
      400,
    );
    const r = (await f.request("/records/tasks", "POST", { title: "Task" }))
      .body;
    await f.request("/records/" + r.id, "PATCH", {
      data: { ...r.data, title: "New" },
      revision: 1,
    });
    assert.equal(
      (await f.request("/records/" + r.id, "DELETE", { revision: 1 })).status,
      409,
    );
  } finally {
    await f.close();
  }
});
test("local command → proposal → explicit approval → one real reminder", async () => {
  const f = await fixture();
  try {
    await f.request("/auth/register", "POST", registration);
    const response = await f.request("/assistant", "POST", {
      text: "Remind me to plan my week tomorrow",
    });
    assert.equal(response.body.engine, "local");
    assert.equal(response.body.actions[0].status, "proposed");
    assert.equal((await f.request("/state")).body.records.length, 0);
    const id = response.body.actions[0].id;
    assert.equal(
      (await f.request("/actions/" + id + "/approve", "POST", {})).body.status,
      "completed",
    );
    await f.request("/actions/" + id + "/approve", "POST", {});
    assert.equal((await f.request("/state")).body.records.length, 1);
  } finally {
    await f.close();
  }
});
test("bulk triage is atomic when one selected revision is stale", async () => {
  const f = await fixture();
  try {
    await f.request("/auth/register", "POST", registration);
    const a = (await f.request("/records/tasks", "POST", { title: "One" }))
        .body,
      b = (await f.request("/records/tasks", "POST", { title: "Two" })).body;
    await f.request("/records/" + b.id, "PATCH", {
      data: { ...b.data, title: "Updated" },
      revision: 1,
    });
    assert.equal(
      (
        await f.request("/triage", "POST", {
          items: [
            { id: a.id, revision: 1 },
            { id: b.id, revision: 1 },
          ],
          operation: "complete",
        })
      ).status,
      409,
    );
    assert.equal(
      (await f.request("/state")).body.records.find((r) => r.id === a.id).data
        .status,
      "open",
    );
  } finally {
    await f.close();
  }
});
test("automation dry runs do not mutate tasks or execute tools", async () => {
  const f = await fixture();
  try {
    await f.request("/auth/register", "POST", registration);
    const auto = (
      await f.request("/records/automations", "POST", {
        title: "Morning review",
        trigger: "morning_briefing",
        action: "summarize_day",
      })
    ).body;
    const result = await f.request(
      "/automations/" + auto.id + "/run",
      "POST",
      {},
    );
    assert.equal(result.body.dryRun, true);
    assert.equal(result.body.executed, 0);
    assert.equal((await f.request("/state")).body.actions.length, 0);
  } finally {
    await f.close();
  }
});
test("provider quota failure creates no proposals and is not retried", async () => {
  const f = await fixture();
  try {
    const user = f.store.register(registration);
    let calls = 0;
    await assert.rejects(
      assist(f.store, user, "Create task", {
        apiKey: "test-not-a-real-key",
        fetch: async () => {
          calls++;
          return { ok: false, status: 429 };
        },
      }),
      /quota/,
    );
    assert.equal(calls, 1);
    assert.equal(f.store.actions(user.id).length, 0);
    assert.equal(f.store.list(user.id).length, 0);
  } finally {
    await f.close();
  }
});
test("malicious model tool names fail without executing operations", async () => {
  const f = await fixture();
  try {
    const user = f.store.register(registration);
    await assert.rejects(
      assist(f.store, user, "Test", {
        apiKey: "test-not-a-real-key",
        fetch: async () => ({
          ok: true,
          json: async () => ({
            output: [
              {
                type: "function_call",
                name: "send_money",
                arguments: '{"amount":100}',
              },
            ],
          }),
        }),
      }),
    );
    assert.equal(f.store.list(user.id).length, 0);
    assert.equal(f.store.actions(user.id).length, 0);
  } finally {
    await f.close();
  }
});
test("unverified model completion claims are never displayed as executed actions", async () => {
  const f = await fixture();
  try {
    const user = f.store.register(registration);
    const result = await assist(f.store, user, "Book a hotel", {
      apiKey: "test-not-a-real-key",
      fetch: async () => ({
        ok: true,
        json: async () => ({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "I booked your hotel. Confirmation FAKE-123.",
                },
              ],
            },
          ],
        }),
      }),
    });
    assert.ok(!result.text.includes("FAKE-123"));
    assert.equal(f.store.list(user.id).length, 0);
  } finally {
    await f.close();
  }
});
test("partial autopilot failure reports completed and failed steps accurately", async () => {
  const f = await fixture();
  try {
    const initial = f.store.register(registration);
    const user = f.store.setSettings(initial.id, {
        name: initial.name,
        timezone: initial.timezone,
        autonomy: "autopilot",
        memoryEnabled: true,
      }),
      task = f.store.create(user.id, "tasks", { title: "One task" });
    const call = {
      type: "function_call",
      name: "complete_task",
      arguments: JSON.stringify({ id: task.id, revision: 1 }),
    };
    const result = await assist(f.store, user, "Complete twice", {
      apiKey: "test-not-a-real-key",
      fetch: async () => ({
        ok: true,
        json: async () => ({ output: [call, call] }),
      }),
    });
    assert.match(result.text, /1.*completed and verified.*1 failed/);
    assert.deepEqual(
      result.actions.map((a) => a.status),
      ["completed", "failed"],
    );
  } finally {
    await f.close();
  }
});
test("cancellation before proposal prevents even preapproved mutations", async () => {
  const f = await fixture();
  try {
    const user = f.store.register(registration),
      controller = new AbortController();
    controller.abort();
    await assert.rejects(
      assist(f.store, user, "Add task: Do not create", {
        signal: controller.signal,
      }),
      /canceled/,
    );
    assert.equal(f.store.list(user.id).length, 0);
    assert.equal(f.store.actions(user.id).length, 0);
  } finally {
    await f.close();
  }
});
test("bulk reschedule changes every selected deadline and retains other fields", async () => {
  const f = await fixture();
  try {
    await f.request("/auth/register", "POST", registration);
    const a = (
        await f.request("/records/tasks", "POST", {
          title: "One",
          priority: "high",
        })
      ).body,
      b = (await f.request("/records/tasks", "POST", { title: "Two" })).body,
      due = "2026-10-08T22:00:00.000Z";
    const result = await f.request("/triage", "POST", {
      items: [a, b].map((r) => ({ id: r.id, revision: r.revision })),
      operation: "reschedule",
      due,
    });
    assert.equal(result.status, 200);
    const state = (await f.request("/state")).body;
    assert.ok(
      state.records.every((r) => r.data.due === due && r.revision === 2),
    );
    assert.equal(
      state.records.find((r) => r.id === a.id).data.priority,
      "high",
    );
  } finally {
    await f.close();
  }
});
test("account deletion requires the correct password and invalidates the session", async () => {
  const f = await fixture();
  try {
    await f.request("/auth/register", "POST", registration);
    assert.equal(
      (await f.request("/account", "DELETE", { password: "wrong-password" }))
        .status,
      401,
    );
    assert.equal((await f.request("/state")).status, 200);
    assert.equal(
      (
        await f.request("/account", "DELETE", {
          password: registration.password,
        })
      ).status,
      200,
    );
    assert.equal((await f.request("/state")).status, 401);
  } finally {
    await f.close();
  }
});
test("AI context obeys explicit memory controls and excludes health, bills and document payloads", async () => {
  const f = await fixture();
  try {
    const user = f.store.register(registration);
    f.store.create(user.id, "preferences", {
      title: "enabled-memory-sentinel",
      notes: "Prefer 9am",
    });
    f.store.create(user.id, "preferences", {
      title: "disabled-memory-sentinel",
      enabled: false,
    });
    f.store.create(user.id, "documents", {
      title: "private-document-sentinel",
    });
    f.store.create(user.id, "journal", {
      title: "private-health-sentinel",
      metric: "sleep",
      measuredAt: "2026-10-07T12:00:00Z",
    });
    f.store.create(user.id, "bills", {
      title: "private-bill-sentinel",
      amount: 100,
      due: "2026-10-07T12:00:00Z",
    });
    let payload = "";
    const stub = async (url, options) => {
      payload = options.body;
      return { ok: true, json: async () => ({ output: [] }) };
    };
    await assist(f.store, user, "Review preferences", {
      apiKey: "test-not-a-real-key",
      fetch: stub,
    });
    assert.ok(payload.includes("enabled-memory-sentinel"));
    for (const text of [
      "disabled-memory-sentinel",
      "private-document-sentinel",
      "private-health-sentinel",
      "private-bill-sentinel",
    ])
      assert.ok(!payload.includes(text));
    const disabled = f.store.setSettings(user.id, {
      name: user.name,
      timezone: user.timezone,
      autonomy: "approval",
      memoryEnabled: false,
    });
    await assist(f.store, disabled, "Review preferences", {
      apiKey: "test-not-a-real-key",
      fetch: stub,
    });
    assert.ok(!payload.includes("enabled-memory-sentinel"));
  } finally {
    await f.close();
  }
});
