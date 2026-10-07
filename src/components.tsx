import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Plus,
  Check,
  CalendarDays,
  Circle,
  Clock3,
  Pencil,
  Trash2,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { type Entity, type Kind, type User, type Action } from "./types";
import { api, post, inputInstant, localInput, formatDate } from "./api";
import { useWorkspace } from "./context";

export function Button({
  children,
  variant = "",
  ...props
}: {
  children: ReactNode;
  variant?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${variant}`} {...props}>
      {children}
    </button>
  );
}
export function Empty({
  icon: Icon = CalendarDays,
  title,
  text,
  action,
}: {
  icon?: any;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={24} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    previous = useRef<Element | null>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    previous.current = document.activeElement;
    const el = ref.current;
    const get = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,[tabindex="0"]',
        ) ?? [],
      ).filter((x) => !x.hasAttribute("disabled"));
    get()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const list = get(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      (previous.current as HTMLElement)?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-head">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export const kindNames: Record<Kind, string> = {
  tasks: "reminder",
  events: "event",
  people: "person",
  bills: "bill",
  documents: "document metadata",
  routines: "routine",
  preferences: "memory",
  bookings: "provider handoff",
  automations: "automation",
  journal: "wellness entry",
  trips: "trip",
};

export function RecordEditor({
  kind,
  record,
  user,
  onClose,
  onSaved,
}: {
  kind: Kind;
  record?: Entity;
  user: User;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { state } = useWorkspace();
  const d = record?.data ?? {};
  const [form, setForm] = useState<Record<string, any>>({
    ...d,
    title: d.title ?? "",
    notes: d.notes ?? "",
    due: d.due ? localInput(d.due, user.timezone) : "",
    start: d.start ? localInput(d.start, user.timezone) : "",
    end: d.end ? localInput(d.end, user.timezone) : "",
    expires: d.expires ? localInput(d.expires, user.timezone) : "",
    measuredAt: d.measuredAt
      ? localInput(d.measuredAt, user.timezone)
      : localInput(new Date().toISOString(), user.timezone),
    priority: d.priority ?? "normal",
    duration: d.duration ?? 30,
    group: d.group ?? "personal",
    category: d.category ?? (kind === "preferences" ? "schedule" : "other"),
    currency: d.currency ?? "USD",
    time: d.time ?? "08:00",
    days: d.days ?? [1, 2, 3, 4, 5],
    enabled: d.enabled ?? true,
    trigger: d.trigger ?? "overdue_tasks",
    action: d.action ?? "suggest_triage",
    metric: d.metric ?? "sleep",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (key: string, value: any) =>
    setForm((x) => ({ ...x, [key]: value }));
  const field = (
    key: string,
    label: string,
    type = "text",
    extra: Record<string, any> = {},
  ) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => change(key, e.target.value)}
        {...extra}
      />
    </label>
  );
  const select = (key: string, label: string, options: [string, string][]) => (
    <label className="field">
      <span>{label}</span>
      <select
        value={form[key] ?? ""}
        onChange={(e) => change(key, e.target.value)}
      >
        {options.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let data: Record<string, any> = { title: form.title, notes: form.notes };
      const instant = (value: string) =>
        form.useOffsets ? Promise.resolve(value) : inputInstant(value);
      if (kind === "tasks")
        data = {
          ...data,
          due: form.due ? await instant(form.due) : null,
          duration: Number(form.duration),
          priority: form.priority,
          status: d.status ?? "open",
          personId: form.personId || null,
        };
      if (kind === "events")
        data = {
          ...data,
          start: await instant(form.start),
          end: await instant(form.end),
          timezone: user.timezone,
          location: form.location ?? "",
          travelMinutes: Number(form.travelMinutes ?? 0),
          tripId: form.tripId || null,
        };
      if (kind === "people")
        data = {
          ...data,
          email: form.email ?? "",
          phone: form.phone ?? "",
          group: form.group,
          birthday: form.birthday ?? "",
          lastContact: d.lastContact ?? null,
        };
      if (kind === "bills")
        data = {
          ...data,
          amount: Number(form.amount),
          currency: form.currency,
          due: await instant(form.due),
          status: d.status ?? "due",
          recurring: !!form.recurring,
        };
      if (kind === "documents")
        data = {
          ...data,
          category: form.category,
          expires: form.expires ? await instant(form.expires) : null,
        };
      if (kind === "routines")
        data = {
          ...data,
          time: form.time,
          days: form.days,
          duration: Number(form.duration),
          enabled: form.enabled,
        };
      if (kind === "preferences")
        data = {
          ...data,
          category: form.category,
          origin: "explicit",
          enabled: form.enabled,
        };
      if (kind === "automations")
        data = {
          ...data,
          trigger: form.trigger,
          action: form.action,
          enabled: form.enabled,
          policy: "suggest",
        };
      if (kind === "journal")
        data = {
          ...data,
          metric: form.metric,
          value:
            form.value === "" || form.value == null ? null : Number(form.value),
          unit: form.unit ?? "",
          measuredAt: await instant(form.measuredAt),
          source: "manual",
        };
      if (kind === "trips")
        data = {
          ...data,
          start: await instant(form.start),
          end: await instant(form.end),
          destination: form.destination ?? "",
        };
      if (kind === "bookings")
        data = {
          ...data,
          category: form.category,
          provider: form.provider,
          handoffUrl: form.handoffUrl,
          status: "provider_handoff",
        };
      if (record?.id)
        await api("/records/" + record.id, {
          method: "PATCH",
          body: JSON.stringify({ data, revision: record.revision }),
        });
      else await post("/records/" + kind, data);
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${record?.id ? "Edit" : "Add"} ${kindNames[kind]}`}
      onClose={onClose}
    >
      <form onSubmit={save} className="editor-form">
        {field("title", kind === "people" ? "Name" : "Title", "text", {
          required: true,
          maxLength: 240,
          autoComplete: "off",
        })}
        {["tasks", "events", "bills", "documents", "journal", "trips"].includes(
          kind,
        ) && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={!!form.useOffsets}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  useOffsets: e.target.checked,
                  ...(e.target.checked && record
                    ? Object.fromEntries(
                        ["due", "start", "end", "expires", "measuredAt"]
                          .filter((k) => d[k])
                          .map((k) => [k, d[k]]),
                      )
                    : !e.target.checked
                      ? Object.fromEntries(
                          ["due", "start", "end", "expires", "measuredAt"]
                            .filter(
                              (k) => f[k] && /([+-]\d{2}:\d{2}|Z)$/.test(f[k]),
                            )
                            .map((k) => [
                              k,
                              Number.isFinite(Date.parse(f[k]))
                                ? localInput(f[k], user.timezone)
                                : "",
                            ]),
                        )
                      : {}),
                }))
              }
            />
            Use explicit UTC offsets (advanced / daylight saving)
          </label>
        )}
        {form.useOffsets && (
          <p className="notice">
            Enter complete ISO timestamps, for example
            2026-11-01T01:30:00-04:00. The offset distinguishes repeated
            daylight-saving hours.
          </p>
        )}
        {["tasks", "bills"].includes(kind) &&
          field(
            "due",
            `Deadline · ${user.timezone}`,
            form.useOffsets ? "text" : "datetime-local",
            { required: kind === "bills" },
          )}
        {["events", "trips"].includes(kind) && (
          <div className="form-two">
            {field(
              "start",
              `Starts · ${user.timezone}`,
              form.useOffsets ? "text" : "datetime-local",
              { required: true },
            )}
            {field("end", "Ends", form.useOffsets ? "text" : "datetime-local", {
              required: true,
            })}
          </div>
        )}
        {kind === "tasks" && (
          <div className="form-two">
            {select("priority", "Priority", [
              ["low", "Low"],
              ["normal", "Normal"],
              ["high", "High"],
            ])}
            {field("duration", "Duration (minutes)", "number", {
              min: 5,
              max: 1440,
            })}
          </div>
        )}
        {kind === "tasks" &&
          state.records.some((r) => r.kind === "people") &&
          select("personId", "Related person", [
            ["", "No linked person"],
            ...state.records
              .filter((r) => r.kind === "people")
              .map((r) => [r.id, r.data.title] as [string, string]),
          ])}
        {kind === "events" && (
          <div className="form-two">
            {field("location", "Location")}
            {field("travelMinutes", "Travel buffer (minutes)", "number", {
              min: 0,
              max: 300,
            })}
          </div>
        )}
        {kind === "events" &&
          state.records.some((r) => r.kind === "trips") &&
          select("tripId", "Related trip", [
            ["", "No linked trip"],
            ...state.records
              .filter((r) => r.kind === "trips")
              .map((r) => [r.id, r.data.title] as [string, string]),
          ])}
        {kind === "people" && (
          <>
            <div className="form-two">
              {field("email", "Email", "email")}
              {field("phone", "Phone", "tel")}
            </div>
            <div className="form-two">
              {select("group", "Group", [
                ["personal", "Personal"],
                ["family", "Family"],
                ["professional", "Professional"],
              ])}
              {field("birthday", "Birthday (MM-DD)", "text", {
                pattern: "[0-9]{2}-[0-9]{2}",
                placeholder: "07-21",
              })}
            </div>
          </>
        )}
        {kind === "bills" && (
          <>
            <div className="form-two">
              {field("amount", "Amount", "number", {
                required: true,
                min: 0,
                step: 0.01,
              })}
              {select("currency", "Currency", [
                ["USD", "USD"],
                ["EUR", "EUR"],
                ["GBP", "GBP"],
                ["CAD", "CAD"],
              ])}
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!form.recurring}
                onChange={(e) => change("recurring", e.target.checked)}
              />
              Recurring obligation (tracking only)
            </label>
          </>
        )}
        {kind === "documents" && (
          <>
            <p className="notice">
              Save a description and expiration date. Document file storage,
              file encryption, and OCR are not available in this version. Keep
              document contents out of notes.
            </p>
            {select("category", "Category", [
              ["insurance", "Insurance"],
              ["identity", "Identity metadata"],
              ["warranty", "Warranty"],
              ["receipt", "Receipt metadata"],
              ["other", "Other"],
            ])}
            {field(
              "expires",
              `Expires · ${user.timezone}`,
              form.useOffsets ? "text" : "datetime-local",
            )}
          </>
        )}
        {kind === "preferences" && (
          <>
            {select("category", "Preference type", [
              ["schedule", "Schedule"],
              ["travel", "Travel"],
              ["dining", "Dining"],
              ["fitness", "Fitness"],
              ["communication", "Communication"],
              ["goal", "Goal"],
            ])}
            <p className="notice">
              This is an explicit preference you entered. You can edit, disable,
              or delete it at any time.
            </p>
          </>
        )}
        {kind === "routines" && (
          <>
            <div className="form-two">
              {field("time", `Time · ${user.timezone}`, "time", {
                required: true,
              })}
              {field("duration", "Duration (minutes)", "number", {
                min: 5,
                max: 300,
              })}
            </div>
            <fieldset className="days">
              <legend>Repeat on</legend>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (name, i) => (
                  <label key={i}>
                    <input
                      type="checkbox"
                      checked={form.days.includes(i)}
                      onChange={(e) =>
                        change(
                          "days",
                          e.target.checked
                            ? [...form.days, i]
                            : form.days.filter((n: number) => n !== i),
                        )
                      }
                    />
                    {name}
                  </label>
                ),
              )}
            </fieldset>
            <p className="notice">
              Routine blocks appear in Today. No background reminders or device
              actions are scheduled.
            </p>
          </>
        )}
        {kind === "automations" && (
          <>
            {select("trigger", "Trigger", [
              ["overdue_tasks", "Overdue reminders"],
              ["morning_briefing", "Morning briefing"],
              ["manual", "Manual"],
            ])}
            {select("action", "Proposed action", [
              ["suggest_triage", "Suggest reminder triage"],
              ["summarize_day", "Summarize saved plans"],
            ])}
            <p className="notice">
              Trigger → review conditions → suggestion → dry run. Automatic
              background execution is unavailable; run it manually to inspect
              the result.
            </p>
          </>
        )}
        {kind === "journal" && (
          <>
            {select("metric", "Entry type", [
              ["sleep", "Sleep"],
              ["hydration", "Hydration"],
              ["activity", "Activity"],
              ["symptom", "Symptom journal"],
            ])}
            <div className="form-two">
              {field("value", "Measured value (optional)", "number", {
                min: 0,
                step: 0.1,
              })}
              {field("unit", "Unit", "text", {
                placeholder: "hours, ml, minutes",
              })}
            </div>
            {field(
              "measuredAt",
              `Recorded at · ${user.timezone}`,
              form.useOffsets ? "text" : "datetime-local",
              { required: true },
            )}
            <p className="notice">
              Manual entry, not wearable data or medical advice. Use consistent
              units when comparing measurements.
            </p>
          </>
        )}
        {kind === "trips" &&
          field("destination", "Destination", "text", { required: true })}
        {kind === "bookings" && (
          <>
            <p className="notice">
              Saved research link only. Availability and booking confirmation
              are unverified.
            </p>
            {select("category", "Category", [
              ["restaurants", "Dining"],
              ["flights", "Flights"],
              ["hotels", "Hotels"],
              ["transport", "Transport"],
              ["activities", "Activities"],
            ])}
            {field("provider", "Provider", "text", { required: true })}
            {field("handoffUrl", "Provider search URL", "url", {
              required: true,
            })}
          </>
        )}
        {["routines", "preferences", "automations"].includes(kind) && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => change("enabled", e.target.checked)}
            />
            Enabled
          </label>
        )}
        <label className="field">
          <span>{kind === "preferences" ? "Preference details" : "Notes"}</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => change("notes", e.target.value)}
            maxLength={6000}
          />
        </label>
        {error && <ErrorBox message={error} />}
        <div className="form-actions">
          <Button type="button" variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            {busy
              ? "Saving…"
              : record?.id
                ? "Save changes"
                : "Add " + kindNames[kind]}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function RecordRow({
  record,
  user,
  onEdit,
  onDelete,
  onToggle,
}: {
  record: Entity;
  user: User;
  onEdit: (r: Entity) => void;
  onDelete: (r: Entity) => void;
  onToggle?: (r: Entity) => void;
}) {
  const d = record.data;
  const done = d.status === "completed" || d.status === "paid";
  let meta = "";
  if (record.kind === "tasks")
    meta = d.due
      ? formatDate(d.due, user.timezone, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "No deadline";
  if (record.kind === "events")
    meta =
      formatDate(d.start, user.timezone, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }) + (d.location ? " · " + d.location : "");
  if (record.kind === "people")
    meta = [
      d.group,
      d.email || d.phone,
      d.birthday
        ? "Birthday " + formatDate("2000-" + d.birthday + "T12:00:00Z", "UTC")
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  if (record.kind === "bills")
    meta =
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: d.currency,
      }).format(d.amount) +
      " · " +
      formatDate(d.due, user.timezone);
  if (record.kind === "documents")
    meta =
      d.category +
      (d.expires
        ? " · Expires " + formatDate(d.expires, user.timezone)
        : " · No expiration");
  if (record.kind === "preferences")
    meta =
      "Explicit preference · " + d.category + (d.enabled ? "" : " · Disabled");
  if (record.kind === "routines")
    meta =
      d.time +
      " · " +
      d.duration +
      " min · " +
      (d.enabled ? "Active" : "Paused");
  if (record.kind === "automations")
    meta =
      d.trigger.replaceAll("_", " ") +
      " · " +
      (d.enabled ? "Ready for dry run" : "Paused");
  if (record.kind === "journal")
    meta = [
      d.value != null ? `${d.value} ${d.unit}` : d.metric,
      "Manual",
      formatDate(d.measuredAt, user.timezone),
    ].join(" · ");
  if (record.kind === "trips")
    meta =
      d.destination +
      " · " +
      formatDate(d.start, user.timezone) +
      " – " +
      formatDate(d.end, user.timezone);
  return (
    <div className={`record-row ${done ? "done" : ""}`}>
      {onToggle && ["tasks", "bills"].includes(record.kind) ? (
        <button
          aria-label={`${done ? "Reopen" : "Complete"} ${d.title}`}
          className={`task-check ${done ? "checked" : ""}`}
          onClick={() => onToggle(record)}
        >
          {done ? <Check size={14} /> : null}
        </button>
      ) : (
        <span className={`row-mark ${record.kind}`}>
          <Circle size={9} fill="currentColor" />
        </span>
      )}
      <button className="row-content" onClick={() => onEdit(record)}>
        <strong>{d.title}</strong>
        <span>{meta}</span>
      </button>
      {record.kind === "tasks" && d.priority === "high" && !done && (
        <Badge tone="amber">High</Badge>
      )}
      <button
        className="icon-button"
        onClick={() => onEdit(record)}
        aria-label={`Edit ${d.title}`}
      >
        <Pencil size={16} />
      </button>
      <button
        className="icon-button danger-hover"
        onClick={() => onDelete(record)}
        aria-label={`Delete ${d.title}`}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function ActionCard({
  action,
  user,
  onAction,
}: {
  action: Action;
  user: User;
  onAction: (id: string, operation: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = action.input;
  const titles: Record<string, string> = {
    create_task: "Create reminder",
    complete_task: "Complete reminder",
    reschedule_task: "Reschedule reminder",
    create_event: "Create event",
    reschedule_event: "Move event",
    search_tasks: "Search reminders",
    search_events: "Search events",
    search_people: "Search contacts",
  };
  async function run(op: string) {
    setBusy(true);
    try {
      await onAction(action.id, op);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="action-card">
      <div className="action-title">
        <Sparkles size={17} />
        <strong>{titles[action.tool] ?? action.tool}</strong>
        <Badge tone={action.status === "completed" ? "green" : ""}>
          {action.status}
        </Badge>
      </div>
      <p>
        {input.title ??
          (input.query !== undefined
            ? input.query || "All saved items"
            : `Record ${String(input.id).slice(0, 8)}`)}
      </p>
      {action.result?.records && (
        <span className="metadata">
          {action.result.records.length} verified saved results
        </span>
      )}
      {(input.due || input.start) && (
        <span className="metadata">
          <Clock3 size={14} />
          {formatDate(input.due || input.start, user.timezone, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {input.end
            ? " – " +
              formatDate(input.end, user.timezone, {
                hour: "numeric",
                minute: "2-digit",
              })
            : ""}{" "}
          · {user.timezone}
        </span>
      )}
      {action.status === "proposed" && (
        <div className="action-buttons">
          <Button
            disabled={busy || ["observe", "suggest"].includes(user.autonomy)}
            onClick={() => run("approve")}
          >
            <Check size={16} />
            {busy ? "Working…" : "Approve change"}
          </Button>
          <Button
            disabled={busy}
            variant="subtle"
            onClick={() => run("dismiss")}
          >
            Dismiss
          </Button>
        </div>
      )}
      {["observe", "suggest"].includes(user.autonomy) &&
        action.status === "proposed" && (
          <p className="metadata">
            Switch to Act with approval in settings to execute.
          </p>
        )}
      {action.error && <ErrorBox message={action.error} />}{" "}
      {error && <ErrorBox message={error} />}
    </div>
  );
}
