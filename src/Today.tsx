import { useState } from "react";
import {
  CalendarDays,
  ArrowUpRight,
  Plus,
  Check,
  Clock3,
  Sparkles,
  ListChecks,
  Users,
  Wallet,
  House,
  Flag,
  ChevronRight,
  Repeat2,
  CircleCheck,
} from "lucide-react";
import { useWorkspace } from "./context";
import {
  Badge,
  Button,
  Empty,
  ActionCard,
  RecordRow,
  ErrorBox,
} from "./components";
import { dayKey, formatDate, post, inputInstant } from "./api";
import { type Entity } from "./types";

export function Today() {
  const { state, now, edit, remove, toggle, notify, refresh, go, ask, action } =
    useWorkspace();
  const { user, records } = state;
  const today = dayKey(now, user.timezone),
    tasks = records.filter((r) => r.kind === "tasks"),
    open = tasks.filter((r) => r.data.status === "open");
  const overdue = open.filter(
    (r) => r.data.due && Date.parse(r.data.due) < now.getTime(),
  );
  const todayEvents = records
    .filter(
      (r) =>
        r.kind === "events" && dayKey(r.data.start, user.timezone) === today,
    )
    .sort((a, b) => Date.parse(a.data.start) - Date.parse(b.data.start));
  const next = todayEvents.find((r) => Date.parse(r.data.end) > now.getTime());
  const priority = (r: Entity) =>
    (r.data.due && Date.parse(r.data.due) < now.getTime() ? 100 : 0) +
    (r.data.due && Date.parse(r.data.due) < now.getTime() + 86400000 ? 20 : 0) +
    ({ high: 10, normal: 5, low: 0 }[
      r.data.priority as "high" | "normal" | "low"
    ] ?? 0);
  const focus =
    next ??
    [...open].sort(
      (a, b) =>
        priority(b) - priority(a) ||
        (a.data.due ? Date.parse(a.data.due) : Infinity) -
          (b.data.due ? Date.parse(b.data.due) : Infinity) ||
        Date.parse(a.createdAt) - Date.parse(b.createdAt),
    )[0];
  const pending = state.actions.filter((a) => a.status === "proposed"),
    failed = state.actions.filter((a) => a.status === "failed");
  const birthdays = records.filter(
      (r) => r.kind === "people" && r.data.birthday === today.slice(5),
    ),
    billsToday = records.filter(
      (r) =>
        r.kind === "bills" &&
        r.data.status === "due" &&
        dayKey(r.data.due, user.timezone) === today,
    );
  const completed = tasks.filter(
    (t) =>
      t.data.status === "completed" &&
      dayKey(t.updatedAt, user.timezone) === today,
  );
  const hour = Number(
    formatDate(now.toISOString(), user.timezone, {
      hour: "numeric",
      hourCycle: "h23",
    }),
  );
  const [capture, setCapture] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!capture.trim()) return;
    setBusy(true);
    try {
      await post("/records/tasks", { title: capture.trim() });
      setCapture("");
      await refresh();
      notify("Reminder added.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function triage(operation: string) {
    setBusy(true);
    setError("");
    try {
      const items = overdue
        .filter((r) => selected.includes(r.id))
        .map((r) => ({ id: r.id, revision: r.revision }));
      const data: any = { items, operation };
      if (operation === "reschedule") {
        const d = new Date(today + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        data.due = await inputInstant(d.toISOString().slice(0, 10) + "T18:00");
      }
      await post("/triage", data);
      setSelected([]);
      await refresh();
      notify(
        operation === "complete"
          ? "Selected reminders completed."
          : "Selected reminders moved to tomorrow at 6pm.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dayOfWeek = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: user.timezone,
      weekday: "short",
    })
      .format(now)
      .replace("Sun", "0")
      .replace("Mon", "1")
      .replace("Tue", "2")
      .replace("Wed", "3")
      .replace("Thu", "4")
      .replace("Fri", "5")
      .replace("Sat", "6"),
  );
  const routines = records.filter(
    (r) =>
      r.kind === "routines" &&
      r.data.enabled &&
      r.data.days.includes(dayOfWeek),
  );
  const timeline = [
    ...todayEvents.map((r) => ({
      record: r,
      time: formatDate(r.data.start, user.timezone, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
      type: "event",
    })),
    ...open
      .filter((r) => r.data.due && dayKey(r.data.due, user.timezone) === today)
      .map((r) => ({
        record: r,
        time: formatDate(r.data.due, user.timezone, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }),
        type: "task",
      })),
    ...records
      .filter(
        (r) =>
          r.kind === "events" &&
          r.data.travelMinutes > 0 &&
          dayKey(
            new Date(Date.parse(r.data.start) - r.data.travelMinutes * 60000),
            user.timezone,
          ) === today,
      )
      .map((r) => ({
        record: r,
        time: formatDate(
          new Date(
            Date.parse(r.data.start) - r.data.travelMinutes * 60000,
          ).toISOString(),
          user.timezone,
          { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
        ),
        type: "buffer",
      })),
    ...routines.map((r) => ({ record: r, time: r.data.time, type: "routine" })),
  ].sort((a, b) => a.time.localeCompare(b.time));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {formatDate(now.toISOString(), user.timezone, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1>
            Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"},{" "}
            {user.name.split(" ")[0]}
            <span className="lime">.</span>
          </h1>
          <p className="heading-note">A clearer view of what matters today.</p>
        </div>
        <Button variant="subtle" onClick={() => ask("Summarize my day")}>
          <Sparkles size={17} />
          Daily briefing
        </Button>
      </div>
      <div className="daily-stats">
        <div>
          <CalendarDays size={18} />
          <strong>{todayEvents.length}</strong>
          <span>events today</span>
        </div>
        <div>
          <ListChecks size={18} />
          <strong>{open.length}</strong>
          <span>open reminders</span>
        </div>
        <div className={overdue.length ? "amber-text" : ""}>
          <Clock3 size={18} />
          <strong>{overdue.length}</strong>
          <span>overdue</span>
        </div>
        <div>
          <CircleCheck size={18} />
          <strong>{completed.length}</strong>
          <span>completed today</span>
        </div>
      </div>
      <div className="today-grid">
        <section className="main-column">
          <section className="focus-card">
            <div className="focus-content">
              <p className="eyebrow">
                <span className="tiny-star">✦</span>{" "}
                {focus ? "YOUR NEXT FOCUS" : "MAKE SPACE FOR YOUR DAY"}
              </p>
              <h2>{focus ? focus.data.title : "Start with one good plan."}</h2>
              <p>
                {focus?.kind === "events"
                  ? `${formatDate(focus.data.start, user.timezone, { hour: "numeric", minute: "2-digit" })} – ${formatDate(focus.data.end, user.timezone, { hour: "numeric", minute: "2-digit" })}${focus.data.location ? " · " + focus.data.location : ""}`
                  : focus
                    ? focus.data.due
                      ? "Due " +
                        formatDate(focus.data.due, user.timezone, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "One small step towards a more organized day."
                    : "Add a commitment or capture something on your mind. Steward will keep the pieces together."}
              </p>
              <Button
                onClick={() =>
                  focus ? edit(focus.kind, focus) : edit("events")
                }
              >
                {focus
                  ? "Review " + (focus.kind === "events" ? "event" : "reminder")
                  : "Plan your first event"}
                <ArrowUpRight size={17} />
              </Button>
            </div>
            <div className="focus-emblem" aria-hidden="true">
              <span>✦</span>
              <div className="orbit o1" />
              <div className="orbit o2" />
            </div>
          </section>
          <form className="quick-capture" onSubmit={add}>
            <Plus size={19} />
            <input
              aria-label="Quick reminder"
              placeholder="Capture a reminder, clear your mind…"
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              maxLength={240}
            />
            <button
              disabled={busy || !capture.trim()}
              aria-label="Add quick reminder"
              className="capture-submit"
            >
              {busy ? "…" : "Add"}
            </button>
            <kbd>↵</kbd>
          </form>
          {error && <ErrorBox message={error} />}
          <section className="panel inbox">
            <div className="section-head">
              <div>
                <span className="section-icon amber-text">
                  <Flag size={19} />
                </span>
                <h2>Needs your attention</h2>
                <Badge>
                  {overdue.length +
                    pending.length +
                    state.conflicts.length +
                    failed.length +
                    birthdays.length +
                    billsToday.length}
                </Badge>
              </div>
              <button className="text-button" onClick={() => go("Plan")}>
                View plans <ChevronRight size={15} />
              </button>
            </div>
            {birthdays.map((r) => (
              <div className="conflict" key={r.id}>
                <Users size={18} />
                <div>
                  <strong>{r.data.title}'s birthday</strong>
                  <p>
                    A date you explicitly saved. Make a little time for them.
                  </p>
                </div>
                <Button
                  variant="small subtle"
                  onClick={() =>
                    edit("tasks", {
                      id: "",
                      kind: "tasks",
                      data: {
                        title: "Wish " + r.data.title + " a happy birthday",
                        personId: r.id,
                      },
                      revision: 0,
                      createdAt: "",
                      updatedAt: "",
                      provenance: "user",
                      syncState: "local",
                    })
                  }
                >
                  Plan outreach
                </Button>
              </div>
            ))}
            {billsToday.map((r) => (
              <div className="conflict" key={r.id}>
                <Wallet size={18} />
                <div>
                  <strong>{r.data.title} is due today</strong>
                  <p>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: r.data.currency,
                    }).format(r.data.amount)}{" "}
                    · manually tracked bill
                  </p>
                </div>
                <Button variant="small subtle" onClick={() => edit("bills", r)}>
                  Review
                </Button>
              </div>
            ))}
            {state.conflicts.map((c) => (
              <div className="conflict" key={c.id}>
                <CalendarDays size={18} />
                <div>
                  <strong>Schedule conflict</strong>
                  <p>
                    {c.title}
                    {c.travelBuffer ? " (including travel)" : ""}
                  </p>
                </div>
                <Button
                  variant="small subtle"
                  onClick={() => {
                    const r = records.find((r) => r.id === c.second);
                    if (r) edit("events", r);
                  }}
                >
                  Resolve
                </Button>
              </div>
            ))}
            {pending.map((a) => (
              <ActionCard key={a.id} action={a} user={user} onAction={action} />
            ))}
            {failed.map((a) => (
              <div className="conflict" key={a.id}>
                <Flag size={18} />
                <div>
                  <strong>Assistant action failed</strong>
                  <p>{a.error ?? "Review the action history."}</p>
                </div>
                <Button variant="small subtle" onClick={() => go("Ask")}>
                  Review
                </Button>
              </div>
            ))}
            {overdue.length > 0 && (
              <>
                <div className="triage-head">
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={selected.length === overdue.length}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? overdue.map((r) => r.id) : [],
                        )
                      }
                    />
                    Select overdue reminders
                  </label>
                  <span>{overdue.length} overdue</span>
                </div>
                {overdue.map((r) => (
                  <div className="triage-row" key={r.id}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.data.title}`}
                      checked={selected.includes(r.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked
                            ? [...s, r.id]
                            : s.filter((id) => id !== r.id),
                        )
                      }
                    />
                    <RecordRow
                      record={r}
                      user={user}
                      onEdit={(r) => edit(r.kind, r)}
                      onDelete={remove}
                      onToggle={toggle}
                    />
                  </div>
                ))}
                {selected.length > 0 && (
                  <div className="bulk-actions">
                    <span>{selected.length} selected</span>
                    <Button
                      variant="small subtle"
                      disabled={busy}
                      onClick={() => triage("reschedule")}
                    >
                      <Clock3 size={15} />
                      Tomorrow, 6pm
                    </Button>
                    <Button
                      variant="small"
                      disabled={busy}
                      onClick={() => triage("complete")}
                    >
                      <Check size={15} />
                      Complete
                    </Button>
                  </div>
                )}
              </>
            )}
            {!overdue.length &&
              !pending.length &&
              !state.conflicts.length &&
              !failed.length &&
              !birthdays.length &&
              !billsToday.length && (
                <Empty
                  icon={CircleCheck}
                  title="A little breathing room"
                  text="No overdue reminders, conflicts, or pending approvals. Your saved workspace is up to date."
                />
              )}
          </section>
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Your life, connected</h2>
              </div>
              <button className="text-button" onClick={() => go("Life")}>
                Open Life <ChevronRight size={15} />
              </button>
            </div>
            <div className="life-shortcuts">
              {[
                {
                  icon: Users,
                  title: "People",
                  detail:
                    records.filter((r) => r.kind === "people").length +
                    " saved contacts",
                },
                {
                  icon: Wallet,
                  title: "Money",
                  detail:
                    records.filter(
                      (r) => r.kind === "bills" && r.data.status === "due",
                    ).length + " tracked bills",
                },
                { icon: House, title: "Home", detail: "No devices connected" },
              ].map((x) => (
                <button key={x.title} onClick={() => go("Life")}>
                  <span className={`shortcut-icon ${x.title.toLowerCase()}`}>
                    <x.icon size={20} />
                  </span>
                  <strong>{x.title}</strong>
                  <span>{x.detail}</span>
                </button>
              ))}
            </div>
          </section>
        </section>
        <aside className="side-column">
          <section className="panel timeline-panel">
            <div className="section-head">
              <div>
                <CalendarDays size={18} />
                <h2>Today's rhythm</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => edit("events")}
                aria-label="Add timeline event"
              >
                <Plus size={18} />
              </button>
            </div>
            <p className="panel-caption">
              {user.timezone.replaceAll("_", " ")} · saved plans
            </p>
            {!timeline.length ? (
              <Empty
                icon={CalendarDays}
                title="An open canvas"
                text="Your events and routine blocks will come together here."
                action={
                  <Button variant="subtle small" onClick={() => edit("events")}>
                    Add an event
                  </Button>
                }
              />
            ) : (
              <div className="timeline">
                {timeline.map(({ record: r, time, type }) => (
                  <button
                    key={r.id + type}
                    className={`timeline-item ${type}`}
                    onClick={() => edit(r.kind, r)}
                  >
                    <time>{time}</time>
                    <span className="timeline-dot" />
                    <div>
                      <span className="metadata">
                        {type === "routine"
                          ? "Routine block"
                          : type === "task"
                            ? "Reminder deadline"
                            : type === "buffer"
                              ? "Travel buffer · user estimate"
                              : "Calendar event"}
                      </span>
                      <strong>
                        {type === "buffer" ? "Travel to " : ""}
                        {r.data.title}
                      </strong>
                      <p>
                        {type === "routine"
                          ? r.data.duration + " min"
                          : type === "task"
                            ? r.data.duration + " min estimated effort"
                            : type === "buffer"
                              ? r.data.travelMinutes + " min planned"
                              : r.data.location ||
                                formatDate(r.data.end, user.timezone, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                }) + " end"}
                      </p>
                      {r.data.travelMinutes > 0 && (
                        <span className="metadata">
                          {r.data.travelMinutes} min travel buffer
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="assistant-note">
            <div className="assistant-note-head">
              <span className="assistant-symbol">✦</span>
              <Badge>
                {state.aiAvailable ? "AI assistant" : "Local commands"}
              </Badge>
            </div>
            <h2>A lighter mental load.</h2>
            <p>
              Turn a thought into a plan. Every proposed change stays in your
              control.
            </p>
            <button onClick={() => ask("Remind me to plan my week tomorrow")}>
              “Remind me to plan my week tomorrow”
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => ask("Summarize my day")}>
              “What needs my attention?”
              <ArrowUpRight size={16} />
            </button>
            <button className="text-button" onClick={() => go("Ask")}>
              Open your assistant <Sparkles size={15} />
            </button>
          </section>
          <section className="end-day">
            <div>
              <Repeat2 size={18} />
              <h3>When the day winds down</h3>
            </div>
            <p>
              {completed.length} completed today. {open.length} reminders remain
              open. Review tomorrow's plans before signing off.
            </p>
            <button className="text-button" onClick={() => go("Plan")}>
              Prepare for tomorrow <ChevronRight size={15} />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
