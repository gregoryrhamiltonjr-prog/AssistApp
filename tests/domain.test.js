import { test } from "node:test";
import assert from "node:assert/strict";
import {
  schemas,
  conflicts,
  localInstant,
  tools,
  settingsSchema,
} from "../server/domain.js";
import { parseLocal } from "../server/assistant.js";
const user = { timezone: "America/New_York" };
test("event schema rejects backward intervals and unknown fields", () => {
  assert.throws(() =>
    schemas.events.parse({
      title: "Meeting",
      start: "2026-10-07T11:00:00Z",
      end: "2026-10-07T10:00:00Z",
    }),
  );
  assert.throws(() =>
    schemas.tasks.parse({ title: "Task", secret: "unexpected" }),
  );
});
test("booking schema rejects fabricated confirmations and unsafe handoffs", () => {
  const b = {
    title: "Dinner",
    category: "restaurants",
    provider: "OpenTable",
    handoffUrl: "https://www.opentable.com/s?term=Boston",
  };
  assert.equal(schemas.bookings.parse(b).status, "provider_handoff");
  for (const patch of [
    { status: "confirmed" },
    { handoffUrl: "javascript:alert(1)" },
    { handoffUrl: "https://evil.example/pay" },
    { confirmation: "FAKE-123" },
  ])
    assert.throws(() => schemas.bookings.parse({ ...b, ...patch }));
});
test("birthday and timezone validation reject invalid inputs", () => {
  assert.throws(() =>
    schemas.people.parse({ title: "Pat", birthday: "02-31" }),
  );
  assert.throws(() =>
    schemas.people.parse({ title: "Pat", birthday: "15-99" }),
  );
  assert.equal(
    schemas.people.parse({ title: "Pat", birthday: "02-29" }).birthday,
    "02-29",
  );
  assert.throws(() =>
    settingsSchema.parse({
      name: "Pat",
      timezone: "Moon/Base",
      autonomy: "approval",
      memoryEnabled: true,
    }),
  );
});
test("conflicts include travel buffers and exclude adjacent intervals", () => {
  const event = (id, start, end, travelMinutes = 0) => ({
    id,
    kind: "events",
    data: { title: id, start, end, travelMinutes },
  });
  const a = event("a", "2026-10-07T10:00:00Z", "2026-10-07T11:00:00Z"),
    b = event("b", "2026-10-07T11:00:00Z", "2026-10-07T12:00:00Z");
  assert.equal(conflicts([a, b]).length, 0);
  assert.equal(
    conflicts([a, { ...b, data: { ...b.data, travelMinutes: 15 } }]).length,
    1,
  );
});
test("timezone conversion covers DST gaps, repeated hours and winter offsets", () => {
  assert.equal(
    localInstant("2026-01-15", "09:00", "America/New_York"),
    "2026-01-15T14:00:00.000Z",
  );
  assert.equal(
    localInstant("2026-07-15", "09:00", "America/New_York"),
    "2026-07-15T13:00:00.000Z",
  );
  assert.throws(
    () => localInstant("2026-03-08", "02:30", "America/New_York"),
    /does not exist/,
  );
  assert.throws(
    () => localInstant("2026-11-01", "01:30", "America/New_York"),
    /occurs twice/,
  );
});
test("local reminder creation resolves tomorrow in the user timezone", () => {
  const result = parseLocal(
    "Remind me to call Grandma tomorrow",
    user,
    [],
    new Date("2026-10-07T02:00:00Z"),
  );
  assert.equal(result.calls[0].input.title, "call Grandma");
  assert.equal(result.calls[0].input.due, "2026-10-07T22:00:00.000Z");
  assert.equal(
    parseLocal(
      "Remind me to prepare briefing tomorrow",
      user,
      [],
      new Date("2026-10-07T02:00:00Z"),
    ).calls[0].input.title,
    "prepare briefing",
  );
});
test("local commands reject uncertain dates and duplicate identities", () => {
  assert.equal(
    parseLocal("Remind me to call Pat this weekend", user, []).calls,
    undefined,
  );
  const records = [1, 2].map((n) => ({
    id: String(n),
    kind: "tasks",
    revision: 1,
    data: { title: "Call Pat", status: "open" },
  }));
  assert.equal(
    parseLocal("Complete task: Call Pat", user, records).calls,
    undefined,
  );
  assert.equal(parseLocal("Turn off my lights", user, []).calls, undefined);
});
test("local event creation creates precise validated intervals", () => {
  const result = parseLocal(
    "Schedule workout tomorrow at 9am for 60 minutes",
    user,
    [],
    new Date("2026-10-06T12:00:00Z"),
  );
  const input = result.calls[0].input;
  assert.equal(input.start, "2026-10-07T13:00:00.000Z");
  assert.equal(input.end, "2026-10-07T14:00:00.000Z");
  assert.ok(tools.create_event.input.safeParse(input).success);
  assert.equal(
    parseLocal("Schedule workout tomorrow at 25:00", user, []).calls,
    undefined,
  );
});
