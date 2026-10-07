import { z } from "zod";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const timestamp = z
  .string()
  .datetime({ offset: true })
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid timestamp");
export const recordOutput = z.object({
  id: z.string().uuid(),
  kind: z.enum([
    "tasks",
    "events",
    "people",
    "bills",
    "documents",
    "routines",
    "preferences",
    "bookings",
    "automations",
    "journal",
    "trips",
  ]),
  data: z.record(z.unknown()),
  revision: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
  provenance: z.string(),
  syncState: z.literal("local"),
});
const title = z.string().trim().min(1).max(240);
const timezone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Unknown timezone");
const notes = z.string().max(6000).default("");
export const kinds = [
  "tasks",
  "events",
  "people",
  "bills",
  "documents",
  "routines",
  "preferences",
  "bookings",
  "automations",
  "journal",
  "trips",
];
export const schemas = {
  tasks: z
    .object({
      title,
      notes,
      due: timestamp.nullable().default(null),
      duration: z.number().int().min(5).max(1440).default(30),
      priority: z.enum(["low", "normal", "high"]).default("normal"),
      status: z.enum(["open", "completed"]).default("open"),
      personId: z.string().nullable().default(null),
    })
    .strict(),
  events: z
    .object({
      title,
      notes,
      start: timestamp,
      end: timestamp,
      timezone: timezone.default("America/New_York"),
      location: z.string().max(500).default(""),
      travelMinutes: z.number().int().min(0).max(300).default(0),
      tripId: z.string().nullable().default(null),
    })
    .strict()
    .refine(
      (v) => Date.parse(v.end) > Date.parse(v.start),
      "End must be after start",
    ),
  people: z
    .object({
      title,
      notes,
      email: z.union([z.string().email(), z.literal("")]).default(""),
      phone: z.string().max(50).default(""),
      group: z.enum(["personal", "professional", "family"]).default("personal"),
      birthday: z
        .string()
        .regex(/^\d{2}-\d{2}$/)
        .or(z.literal(""))
        .refine((v) => {
          if (!v) return true;
          const d = new Date("2000-" + v + "T12:00:00Z");
          return (
            Number.isFinite(d.getTime()) && d.toISOString().slice(5, 10) === v
          );
        }, "Invalid birthday")
        .default(""),
      lastContact: timestamp.nullable().default(null),
    })
    .strict(),
  bills: z
    .object({
      title,
      notes,
      amount: z.number().min(0).max(100000000),
      currency: z.enum(["USD", "EUR", "GBP", "CAD"]).default("USD"),
      due: timestamp,
      status: z.enum(["due", "paid"]).default("due"),
      recurring: z.boolean().default(false),
    })
    .strict(),
  documents: z
    .object({
      title,
      notes,
      category: z
        .enum(["insurance", "identity", "warranty", "receipt", "other"])
        .default("other"),
      expires: timestamp.nullable().default(null),
    })
    .strict(),
  routines: z
    .object({
      title,
      notes,
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      days: z.array(z.number().int().min(0).max(6)).min(1),
      duration: z.number().int().min(5).max(300).default(30),
      enabled: z.boolean().default(true),
    })
    .strict(),
  preferences: z
    .object({
      title,
      notes,
      category: z
        .enum([
          "schedule",
          "travel",
          "dining",
          "fitness",
          "communication",
          "goal",
        ])
        .default("schedule"),
      origin: z.literal("explicit").default("explicit"),
      enabled: z.boolean().default(true),
    })
    .strict(),
  bookings: z
    .object({
      title,
      notes,
      category: z.enum([
        "restaurants",
        "flights",
        "hotels",
        "transport",
        "activities",
      ]),
      provider: z.string().max(100),
      handoffUrl: z
        .string()
        .url()
        .max(2000)
        .refine((v) => {
          try {
            const u = new URL(v);
            return (
              u.protocol === "https:" &&
              !u.username &&
              !u.password &&
              [
                "www.opentable.com",
                "www.google.com",
                "www.booking.com",
                "www.eventbrite.com",
              ].includes(u.hostname)
            );
          } catch {
            return false;
          }
        }, "Only supported HTTPS provider handoffs are allowed"),
      status: z.literal("provider_handoff").default("provider_handoff"),
    })
    .strict(),
  automations: z
    .object({
      title,
      notes,
      trigger: z.enum(["manual", "overdue_tasks", "morning_briefing"]),
      action: z.enum(["suggest_triage", "summarize_day"]),
      enabled: z.boolean().default(true),
      policy: z.literal("suggest").default("suggest"),
    })
    .strict(),
  journal: z
    .object({
      title,
      notes,
      metric: z.enum(["sleep", "hydration", "activity", "symptom"]),
      value: z.number().min(0).max(100000).nullable().default(null),
      unit: z.string().max(40).default(""),
      measuredAt: timestamp,
      source: z.literal("manual").default("manual"),
    })
    .strict(),
  trips: z
    .object({
      title,
      notes,
      start: timestamp,
      end: timestamp,
      destination: z.string().max(500),
    })
    .strict()
    .refine(
      (v) => Date.parse(v.end) >= Date.parse(v.start),
      "Trip end must follow start",
    ),
};
export const settingsSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone"),
    autonomy: z.enum(["observe", "suggest", "approval", "autopilot"]),
    memoryEnabled: z.boolean(),
  })
  .strict();

export function conflicts(events) {
  const sorted = events
    .filter((x) => x.kind === "events")
    .sort((a, b) => Date.parse(a.data.start) - Date.parse(b.data.start));
  const result = [];
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i],
        b = sorted[j],
        end = Date.parse(a.data.end),
        start = Date.parse(b.data.start) - b.data.travelMinutes * 60000;
      if (start < end && Date.parse(b.data.end) > Date.parse(a.data.start))
        result.push({
          id: `${a.id}:${b.id}`,
          first: a.id,
          second: b.id,
          title: `${a.data.title} overlaps ${b.data.title}`,
          travelBuffer: b.data.travelMinutes > 0,
        });
    }
  return result;
}
export function zonedDay(date, timezone) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}
export function localInstant(date, time, timezone) {
  const input = `${date}T${time}:00`,
    instant = fromZonedTime(input, timezone);
  if (
    !Number.isFinite(instant.getTime()) ||
    formatInTimeZone(instant, timezone, "yyyy-MM-dd'T'HH:mm:ss") !== input
  )
    throw new Error(
      "That local time does not exist in this timezone. Choose another time.",
    );
  // During fall-back an explicit offset is needed to disambiguate the repeated hour.
  const alternate = new Date(instant.getTime() + 3600000);
  const previous = new Date(instant.getTime() - 3600000);
  if (
    [alternate, previous].some(
      (d) => formatInTimeZone(d, timezone, "yyyy-MM-dd'T'HH:mm:ss") === input,
    )
  )
    throw new Error(
      "That local time occurs twice. Use the event form with an explicit UTC offset.",
    );
  return instant.toISOString();
}

export const tools = {
  search_tasks: {
    label: "Search reminders",
    scope: "tasks.read",
    input: z.object({ query: z.string().max(240) }).strict(),
    read: true,
    output: z.object({
      records: z.array(recordOutput),
      scope: z.literal("tasks.read"),
    }),
  },
  search_events: {
    label: "Search calendar",
    scope: "events.read",
    input: z.object({ query: z.string().max(240) }).strict(),
    read: true,
    output: z.object({
      records: z.array(recordOutput),
      scope: z.literal("events.read"),
    }),
  },
  search_people: {
    label: "Search contacts",
    scope: "people.read",
    input: z.object({ query: z.string().max(240) }).strict(),
    read: true,
    output: z.object({
      records: z.array(recordOutput),
      scope: z.literal("people.read"),
    }),
  },
  create_task: {
    label: "Create reminder",
    scope: "tasks.write",
    input: z
      .object({
        title,
        due: timestamp.nullable(),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
      })
      .strict(),
    reversible: true,
  },
  complete_task: {
    label: "Complete reminder",
    scope: "tasks.write",
    input: z
      .object({ id: z.string().uuid(), revision: z.number().int().positive() })
      .strict(),
    reversible: true,
  },
  reschedule_task: {
    label: "Reschedule reminder",
    scope: "tasks.write",
    input: z
      .object({
        id: z.string().uuid(),
        revision: z.number().int().positive(),
        due: timestamp,
      })
      .strict(),
    reversible: true,
  },
  create_event: {
    label: "Create calendar event",
    scope: "events.write",
    input: z
      .object({ title, start: timestamp, end: timestamp, timezone })
      .strict()
      .refine(
        (v) => Date.parse(v.end) > Date.parse(v.start),
        "End must follow start",
      ),
    reversible: true,
  },
  reschedule_event: {
    label: "Reschedule event",
    scope: "events.write",
    input: z
      .object({
        id: z.string().uuid(),
        revision: z.number().int().positive(),
        start: timestamp,
        end: timestamp,
      })
      .strict()
      .refine(
        (v) => Date.parse(v.end) > Date.parse(v.start),
        "End must follow start",
      ),
    reversible: true,
  },
};
for (const tool of Object.values(tools))
  if (!tool.read)
    tool.output = z.object({
      record: recordOutput,
      scope: z.literal(tool.scope),
    });
// The model only prepares these tools. Application code authorizes and executes them.
export const modelTools = [
  ["search_tasks", "Search saved reminders", { query: { type: "string" } }],
  ["search_events", "Search saved events", { query: { type: "string" } }],
  [
    "search_people",
    "Search explicitly saved contacts",
    { query: { type: "string" } },
  ],
  [
    "create_task",
    "Prepare a reminder",
    {
      title: { type: "string" },
      due: {
        type: ["string", "null"],
        description: "ISO timestamp with offset, or null if no deadline",
      },
      priority: { type: "string", enum: ["low", "normal", "high"] },
    },
  ],
  [
    "complete_task",
    "Prepare completing a specific existing task",
    { id: { type: "string" }, revision: { type: "integer" } },
  ],
  [
    "reschedule_task",
    "Prepare rescheduling an existing task",
    {
      id: { type: "string" },
      revision: { type: "integer" },
      due: { type: "string" },
    },
  ],
  [
    "create_event",
    "Prepare a new event",
    {
      title: { type: "string" },
      start: { type: "string" },
      end: { type: "string" },
      timezone: { type: "string" },
    },
  ],
  [
    "reschedule_event",
    "Prepare moving an existing event",
    {
      id: { type: "string" },
      revision: { type: "integer" },
      start: { type: "string" },
      end: { type: "string" },
    },
  ],
].map(([name, description, properties]) => ({
  type: "function",
  name,
  description,
  strict: true,
  parameters: {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  },
}));
