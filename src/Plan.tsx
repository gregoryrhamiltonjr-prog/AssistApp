import { useState } from "react";
import {
  Plus,
  CalendarDays,
  ListChecks,
  Search,
  Folder,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Repeat2,
} from "lucide-react";
import { useWorkspace } from "./context";
import { Badge, Button, Empty, RecordRow } from "./components";
import { dayKey, formatDate } from "./api";
import { type Kind } from "./types";
export function Plan() {
  const { state, now, edit, remove, toggle } = useWorkspace();
  const { user, records } = state;
  const [view, setView] = useState<Kind>("events"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("open"),
    [date, setDate] = useState(dayKey(now, user.timezone));
  const list = records.filter(
    (r) =>
      r.kind === view &&
      r.data.title.toLowerCase().includes(search.toLowerCase()) &&
      (view !== "tasks" || filter === "all" || r.data.status === filter),
  );
  const dayEvents = list
    .filter(
      (r) => view !== "events" || dayKey(r.data.start, user.timezone) === date,
    )
    .sort(
      (a, b) =>
        Date.parse(a.data.start ?? a.data.due ?? a.createdAt) -
        Date.parse(b.data.start ?? b.data.due ?? b.createdAt),
    );
  const shift = (n: number) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    setDate(d.toISOString().slice(0, 10));
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A PLACE FOR EVERY COMMITMENT</p>
          <h1>
            Your plans<span className="lime">.</span>
          </h1>
          <p className="heading-note">
            Bring time, tasks, and intentions into the same picture.
          </p>
        </div>
        <Button onClick={() => edit(view)}>
          <Plus size={17} />
          Add{" "}
          {view === "tasks"
            ? "reminder"
            : view === "events"
              ? "event"
              : view === "routines"
                ? "routine"
                : "trip"}
        </Button>
      </div>
      <div className="view-tabs" role="tablist" aria-label="Planning views">
        {[
          { kind: "events", label: "Calendar", icon: CalendarDays },
          { kind: "tasks", label: "Reminders", icon: ListChecks },
          { kind: "routines", label: "Routines", icon: Repeat2 },
          { kind: "trips", label: "Trips", icon: Folder },
        ].map((x) => (
          <button
            key={x.kind}
            role="tab"
            aria-selected={view === x.kind}
            onClick={() => setView(x.kind as Kind)}
            className={view === x.kind ? "active" : ""}
          >
            <x.icon size={17} />
            {x.label}
            <span>{records.filter((r) => r.kind === x.kind).length}</span>
          </button>
        ))}
      </div>
      <div className="plan-layout">
        <section className="panel plan-main">
          <div className="plan-toolbar">
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Search plans"
                placeholder="Search your plans"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {view === "tasks" && (
              <select
                aria-label="Reminder status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="all">All reminders</option>
              </select>
            )}
          </div>
          {view === "events" && (
            <div className="calendar-toolbar">
              <div>
                <h2>
                  {formatDate(date + "T12:00:00Z", "UTC", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
                <span>{user.timezone.replaceAll("_", " ")}</span>
              </div>
              <div>
                <button
                  aria-label="Previous day"
                  className="icon-button"
                  onClick={() => shift(-1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <input
                  type="date"
                  aria-label="Calendar day"
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                />
                <button
                  aria-label="Next day"
                  className="icon-button"
                  onClick={() => shift(1)}
                >
                  <ChevronRight size={18} />
                </button>
                <Button
                  variant="small subtle"
                  onClick={() => setDate(dayKey(now, user.timezone))}
                >
                  Today
                </Button>
              </div>
            </div>
          )}
          {dayEvents.length ? (
            dayEvents.map((r) => (
              <RecordRow
                key={r.id}
                record={r}
                user={user}
                onEdit={(r) => edit(r.kind, r)}
                onDelete={remove}
                onToggle={toggle}
              />
            ))
          ) : (
            <Empty
              icon={view === "tasks" ? ListChecks : CalendarDays}
              title={
                search
                  ? "No matching plans"
                  : view === "events"
                    ? "Make time for what matters"
                    : "Nothing here yet"
              }
              text={
                search
                  ? "Try another title."
                  : view === "events"
                    ? "Add an event for this day. Travel buffers and overlapping events are checked together."
                    : "Add your first item. Everything you save stays in your private workspace."
              }
              action={
                <Button variant="small" onClick={() => edit(view)}>
                  <Plus size={15} />
                  Add your first{" "}
                  {view === "tasks"
                    ? "reminder"
                    : view === "routines"
                      ? "routine"
                      : view === "trips"
                        ? "trip"
                        : "event"}
                </Button>
              }
            />
          )}
        </section>
        <aside>
          <section className="panel planning-summary">
            <p className="eyebrow">THE BIG PICTURE</p>
            <h2>A plan that fits your life.</h2>
            <div>
              <CalendarDays size={18} />
              <span>Saved events</span>
              <strong>
                {records.filter((r) => r.kind === "events").length}
              </strong>
            </div>
            <div>
              <ListChecks size={18} />
              <span>Open reminders</span>
              <strong>
                {
                  records.filter(
                    (r) => r.kind === "tasks" && r.data.status === "open",
                  ).length
                }
              </strong>
            </div>
            <div>
              <Clock3 size={18} />
              <span>Schedule conflicts</span>
              <strong>{state.conflicts.length}</strong>
            </div>
          </section>
          {state.conflicts.length > 0 && (
            <section className="panel conflict-summary">
              <h3>Give these a second look</h3>
              {state.conflicts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    const r = records.find((r) => r.id === c.second);
                    if (r) edit(r.kind, r);
                  }}
                >
                  {c.title}
                  <Badge tone="amber">Overlap</Badge>
                </button>
              ))}
            </section>
          )}
          <p className="sidebar-note">
            This calendar stores your plans locally. Apple and third-party
            calendar synchronization are not connected.
          </p>
        </aside>
      </div>
    </>
  );
}
