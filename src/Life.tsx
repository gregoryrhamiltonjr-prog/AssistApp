import { useState } from "react";
import {
  Users,
  HeartPulse,
  Wallet,
  FileText,
  House,
  Repeat2,
  Brain,
  Workflow,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  ShieldCheck,
  Download,
  Trash2,
  Power,
  Play,
  Pencil,
  CalendarDays,
  LogOut,
  Clock3,
  Link2,
  Check,
} from "lucide-react";
import { useWorkspace } from "./context";
import { Badge, Button, Empty, ErrorBox, Modal, RecordRow } from "./components";
import { api, post, formatDate } from "./api";
import { type Entity, type Kind, type User } from "./types";
const modules = [
  {
    id: "people",
    title: "People",
    subtitle: "The people who matter",
    icon: Users,
    kind: "people",
  },
  {
    id: "health",
    title: "Health & wellness",
    subtitle: "A little more in tune",
    icon: HeartPulse,
    kind: "journal",
  },
  {
    id: "money",
    title: "Money",
    subtitle: "Keep obligations in sight",
    icon: Wallet,
    kind: "bills",
  },
  {
    id: "documents",
    title: "Documents",
    subtitle: "Dates and details, organized",
    icon: FileText,
    kind: "documents",
  },
  {
    id: "home",
    title: "Home",
    subtitle: "Your space, thoughtfully managed",
    icon: House,
  },
  {
    id: "routines",
    title: "Routines",
    subtitle: "Create your own rhythm",
    icon: Repeat2,
    kind: "routines",
  },
  {
    id: "memory",
    title: "Assistant memory",
    subtitle: "Preferences, on your terms",
    icon: Brain,
    kind: "preferences",
  },
  {
    id: "automations",
    title: "Automations",
    subtitle: "Consider the next useful step",
    icon: Workflow,
    kind: "automations",
  },
  {
    id: "connections",
    title: "Connected accounts",
    subtitle: "Know exactly what is connected",
    icon: Plug,
  },
  {
    id: "settings",
    title: "Preferences & privacy",
    subtitle: "Make Steward yours",
    icon: Settings,
  },
];
export function Life({ onLogout }: { onLogout: () => void }) {
  const { state, edit, remove, toggle, refresh, notify, update, go } =
    useWorkspace();
  const [module, setModule] = useState(""),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [info, setInfo] = useState<{ title: string; text: string } | null>(null),
    [busy, setBusy] = useState("");
  const current = modules.find((m) => m.id === module);
  const kind = current?.kind as Kind | undefined;
  const list = state.records.filter(
    (r) =>
      r.kind === kind &&
      r.data.title.toLowerCase().includes(search.toLowerCase()),
  );
  async function run(r: Entity) {
    setBusy(r.id);
    try {
      const response = await post("/automations/" + r.id + "/run");
      await refresh();
      setInfo({
        title: "Dry run · " + r.data.title,
        text:
          response.text +
          " No changes were executed. The result is saved in your assistant conversation.",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function open(id: string) {
    setModule(id);
    setSearch("");
    setError("");
  }
  const people = state.records.filter((r) => r.kind === "people"),
    bills = state.records.filter(
      (r) => r.kind === "bills" && r.data.status === "due",
    );
  return (
    <>
      {!current ? (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">THE BIGGER PICTURE</p>
              <h1>
                A life, well kept<span className="lime">.</span>
              </h1>
              <p className="heading-note">
                Your people, preferences, and everyday essentials.
              </p>
            </div>
            <Badge>Private local workspace</Badge>
          </div>
          <div className="life-grid">
            {modules.map((m, i) => (
              <button
                key={m.id}
                className={`life-module module-${m.id}`}
                onClick={() => open(m.id)}
              >
                <span className="module-icon">
                  <m.icon size={23} />
                </span>
                <ChevronRight size={18} className="module-chevron" />
                <h2>{m.title}</h2>
                <p>{m.subtitle}</p>
                <span className="module-footer">
                  {m.kind
                    ? `${state.records.filter((r) => r.kind === m.kind).length} saved ${m.id === "people" ? "contacts" : m.id === "money" ? "bills" : "items"}`
                    : m.id === "home" || m.id === "connections"
                      ? "No services connected"
                      : "Your controls"}
                </span>
              </button>
            ))}
          </div>
          <section className="privacy-callout">
            <ShieldCheck size={27} />
            <div>
              <h3>Personal means personal.</h3>
              <p>
                Your workspace is stored on this server. You choose what to
                remember and when to act. External services stay disconnected
                until their real integrations are configured.
              </p>
            </div>
            <Button variant="subtle" onClick={() => open("settings")}>
              Privacy controls
            </Button>
          </section>
        </>
      ) : (
        <>
          <button className="text-button back-button" onClick={() => open("")}>
            <ChevronLeft size={16} />
            Back to Life
          </button>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                YOUR LIFE / {current.title.toUpperCase()}
              </p>
              <h1>
                {current.title}
                <span className="lime">.</span>
              </h1>
              <p className="heading-note">{current.subtitle}</p>
            </div>
            {kind && (
              <Button onClick={() => edit(kind)}>
                <Plus size={17} />
                Add{" "}
                {module === "people"
                  ? "person"
                  : module === "health"
                    ? "entry"
                    : module === "money"
                      ? "bill"
                      : module === "memory"
                        ? "preference"
                        : module === "automations"
                          ? "automation"
                          : module === "routines"
                            ? "routine"
                            : "metadata"}
              </Button>
            )}
          </div>
          {module === "settings" ? (
            <SettingsPanel onLogout={onLogout} />
          ) : module === "home" ? (
            <>
              <section className="panel">
                <Empty
                  icon={House}
                  title="Your home starts with a connection"
                  text="HomeKit and Matter device access require a native Apple app, entitlements, and user authorization. No devices are connected and no location is being tracked."
                  action={
                    <Button
                      variant="subtle"
                      onClick={() =>
                        setInfo({
                          title: "Home integration requirements",
                          text: "Native iOS target, HomeKit entitlement, purpose string, and real-device authorization are required. Device controls must wait for verified accessory responses. This web app cannot control HomeKit devices.",
                        })
                      }
                    >
                      View requirements
                    </Button>
                  }
                />
              </section>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Keep your home in order</h2>
                  </div>
                </div>
                <p className="panel-text">
                  Track maintenance, groceries, returns, and household errands
                  with reminders.
                </p>
                <Button variant="subtle" onClick={() => edit("tasks")}>
                  Add household reminder
                </Button>
              </section>
            </>
          ) : module === "connections" ? (
            <Connections onInfo={setInfo} />
          ) : (
            <>
              {module === "memory" && (
                <div className="notice memory-control">
                  <Brain size={20} />
                  <div>
                    <strong>Explicit preferences only</strong>
                    <p>
                      {state.user.memoryEnabled
                        ? "Enabled preferences can be used by the assistant when live AI is connected."
                        : "Assistant memory is disabled. Your saved preferences are retained but excluded from AI context."}
                    </p>
                  </div>
                  <Button
                    variant="small subtle"
                    onClick={async () => {
                      const u = state.user;
                      try {
                        await api("/settings", {
                          method: "PUT",
                          body: JSON.stringify({
                            name: u.name,
                            timezone: u.timezone,
                            autonomy: u.autonomy,
                            memoryEnabled: !u.memoryEnabled,
                          }),
                        });
                        await refresh();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {state.user.memoryEnabled
                      ? "Disable memory"
                      : "Enable memory"}
                  </Button>
                </div>
              )}
              {module === "money" && (
                <div className="mini-metrics">
                  {Array.from(new Set(bills.map((r) => r.data.currency))).map(
                    (currency) => (
                      <div key={currency}>
                        <span>Unpaid · {currency}</span>
                        <strong>
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency,
                          }).format(
                            bills
                              .filter((r) => r.data.currency === currency)
                              .reduce((total, r) => total + r.data.amount, 0),
                          )}
                        </strong>
                      </div>
                    ),
                  )}
                  <p className="notice">
                    Manual bill tracking only. Marking a bill paid records your
                    own status; it does not send money. Bank balances and
                    transactions are unavailable.
                  </p>
                </div>
              )}
              {module === "health" && (
                <HealthSummary records={list} timezone={state.user.timezone} />
              )}
              {module === "documents" && (
                <p className="notice">
                  Metadata and expiration reminders only. This version does not
                  upload or encrypt document files. Do not enter identification
                  numbers or sensitive document contents.
                </p>
              )}
              {module === "automations" && (
                <p className="notice">
                  Design suggestions and run them manually. Automatic triggers,
                  scheduled execution, push notifications, and external actions
                  are unavailable. Dry runs are saved in Ask.
                </p>
              )}
              <section className="panel">
                <div className="plan-toolbar">
                  <div className="search-input">
                    <Search size={17} />
                    <input
                      aria-label={`Search ${current.title}`}
                      placeholder={`Search ${current.title.toLowerCase()}`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Badge>{list.length} saved</Badge>
                </div>
                {list.length ? (
                  list.map((r) => (
                    <div key={r.id}>
                      <RecordRow
                        record={r}
                        user={state.user}
                        onEdit={(r) => edit(r.kind, r)}
                        onDelete={remove}
                        onToggle={toggle}
                      />
                      {module === "people" && (
                        <div className="record-extra">
                          <Button
                            variant="small subtle"
                            onClick={() =>
                              edit("tasks", {
                                id: "",
                                kind: "tasks",
                                data: {
                                  title: "Reach out to " + r.data.title,
                                  personId: r.id,
                                },
                                revision: 0,
                                createdAt: "",
                                updatedAt: "",
                                provenance: "user",
                                syncState: "local",
                              } as Entity)
                            }
                          >
                            <CalendarDays size={14} />
                            Draft follow-up reminder
                          </Button>
                          <Button
                            variant="small subtle"
                            onClick={() =>
                              void update(r, {
                                lastContact: new Date().toISOString(),
                              }).catch(() => {})
                            }
                          >
                            <Check size={14} />
                            Mark contact today
                          </Button>
                          {r.data.lastContact && (
                            <span className="metadata">
                              Last contact:{" "}
                              {formatDate(
                                r.data.lastContact,
                                state.user.timezone,
                              )}
                            </span>
                          )}
                        </div>
                      )}
                      {["memory", "routines", "automations"].includes(
                        module,
                      ) && (
                        <div className="record-extra">
                          <Button
                            variant="small subtle"
                            onClick={() =>
                              void update(r, {
                                enabled: !r.data.enabled,
                              }).catch(() => {})
                            }
                          >
                            <Power size={14} />
                            {r.data.enabled ? "Pause" : "Enable"}
                          </Button>
                          {module === "automations" && (
                            <Button
                              variant="small subtle"
                              disabled={busy === r.id || !r.data.enabled}
                              onClick={() => run(r)}
                            >
                              <Play size={14} />
                              {busy === r.id ? "Running…" : "Dry run"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    icon={current.icon}
                    title={search ? "No matches" : "A little more organized"}
                    text={
                      search
                        ? "Try another name or title."
                        : module === "people"
                          ? "Add someone important, a meaningful note, or a date you want to remember."
                          : "Add the first item to your private workspace."
                    }
                    action={
                      !search && kind ? (
                        <Button variant="small" onClick={() => edit(kind)}>
                          <Plus size={15} />
                          Add your first item
                        </Button>
                      ) : undefined
                    }
                  />
                )}
              </section>
            </>
          )}
          {error && <ErrorBox message={error} />}
        </>
      )}
      {info && (
        <Modal title={info.title} onClose={() => setInfo(null)}>
          <p className="modal-copy">{info.text}</p>
          <Button onClick={() => setInfo(null)}>Got it</Button>
        </Modal>
      )}
    </>
  );
}
function HealthSummary({
  records,
  timezone,
}: {
  records: Entity[];
  timezone: string;
}) {
  const sleep = records
    .filter((r) => r.data.metric === "sleep" && r.data.value !== null)
    .sort(
      (a, b) => Date.parse(b.data.measuredAt) - Date.parse(a.data.measuredAt),
    );
  const latest = sleep[0],
    previous = sleep.find(
      (r, i) => i > 0 && r.data.unit && r.data.unit === latest?.data.unit,
    );
  const delta =
    latest && previous ? latest.data.value - previous.data.value : null;
  return (
    <section className="health-summary">
      <span className="module-icon">
        <HeartPulse size={25} />
      </span>
      <div>
        <p className="eyebrow">YOUR OWN WELLNESS JOURNAL</p>
        <h2>
          {latest
            ? `${latest.data.value} ${latest.data.unit || "(unit not entered)"}`
            : "Start with how you feel."}
        </h2>
        <p>
          {latest
            ? `Sleep · Manual entry · ${formatDate(latest.data.measuredAt, timezone, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : "Record sleep, hydration, activity, or a symptom note. No wearable or Apple Health source is connected."}
        </p>
        {delta !== null && (
          <Badge>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)} {latest.data.unit} versus previous entry
          </Badge>
        )}
      </div>
    </section>
  );
}
function Connections({
  onInfo,
}: {
  onInfo: (v: { title: string; text: string }) => void;
}) {
  const list = [
    {
      name: "Apple Calendar & Reminders",
      icon: CalendarDays,
      text: "Requires a native iOS app with EventKit permissions. This web app stores its own events and reminders; it does not synchronize with Apple.",
    },
    {
      name: "Apple Health & wearables",
      icon: HeartPulse,
      text: "HealthKit requires a native target, a supported device, health entitlements, and granular consent. Wearables need authorized provider APIs. Manual wellness journaling is available.",
    },
    {
      name: "Apple Home & Matter",
      icon: House,
      text: "Requires native HomeKit support, device pairing, and user consent. No device commands are available.",
    },
    {
      name: "Bank accounts",
      icon: Wallet,
      text: "Requires an authorized financial provider, server-side credentials, explicit account consent, and a security review. Manual bill tracking is available; money movement is disabled.",
    },
    {
      name: "Booking providers",
      icon: Link2,
      text: "Direct availability and booking APIs require commercial provider access and verified contracts. Discover currently offers clearly labeled provider handoffs.",
    },
    {
      name: "Calendar providers",
      icon: Plug,
      text: "Google and Microsoft calendar access require app-owned OAuth authorization-code flows with PKCE, incremental synchronization, conflict resolution, and disconnect controls. They are not implemented yet.",
    },
  ];
  return (
    <section className="panel connections">
      {list.map((x) => (
        <div key={x.name}>
          <span className="shortcut-icon">
            <x.icon size={20} />
          </span>
          <div>
            <strong>{x.name}</strong>
            <p>Not connected</p>
          </div>
          <Button
            variant="small subtle"
            onClick={() => onInfo({ title: x.name, text: x.text })}
          >
            Requirements
          </Button>
        </div>
      ))}
    </section>
  );
}
function SettingsPanel({ onLogout }: { onLogout: () => void }) {
  const { state, refresh, notify } = useWorkspace();
  const [form, setForm] = useState({ ...state.user }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [password, setPassword] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          timezone: form.timezone,
          autonomy: form.autonomy,
          memoryEnabled: form.memoryEnabled,
        }),
      });
      await refresh();
      notify("Preferences saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await post("/auth/logout");
    onLogout();
  }
  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      onLogout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="panel settings-form" onSubmit={save}>
        <div className="section-head">
          <div>
            <Settings size={19} />
            <h2>Your preferences</h2>
          </div>
        </div>
        <label className="field">
          <span>Name</span>
          <input
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Timezone</span>
          <input
            required
            list="timezones"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
          <datalist id="timezones">
            {Intl.supportedValuesOf("timeZone").map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Assistant permission</span>
          <select
            value={form.autonomy}
            onChange={(e) =>
              setForm({ ...form, autonomy: e.target.value as User["autonomy"] })
            }
          >
            <option value="observe">Observe · summaries only</option>
            <option value="suggest">Suggest · prepare, never execute</option>
            <option value="approval">
              Act with approval · confirm every change
            </option>
            <option value="autopilot">
              Limited autopilot · create and complete reminders
            </option>
          </select>
        </label>
        <p className="notice">
          Limited autopilot preapproves only reminder creation and completion.
          Changing events and rescheduling reminders still need approval. No
          supported mode permits payments, external messages, bookings, or
          device control.
        </p>
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.memoryEnabled}
            onChange={(e) =>
              setForm({ ...form, memoryEnabled: e.target.checked })
            }
          />
          Allow enabled explicit preferences in assistant context
        </label>
        <p className="notice">
          When live AI is configured, your request, recent assistant
          conversation, saved tasks and events, and enabled preferences are sent
          to OpenAI. Document contents, health entries, and financial records
          are excluded. All records are stored in a server-local SQLite
          database. Private record payloads are encrypted with AES-256-GCM using
          a server-local key. This protects copied database contents, not a
          compromised server. Passkeys, managed backups, and production hosting
          have not been implemented.
        </p>
        {error && <ErrorBox message={error} />}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save preferences"}
        </Button>
      </form>
      <section className="panel data-controls">
        <div className="section-head">
          <div>
            <ShieldCheck size={19} />
            <h2>Your data</h2>
          </div>
        </div>
        <div>
          <a href="/api/export" className="button subtle" download>
            <Download size={17} />
            Export workspace
          </a>
          <Button variant="subtle" onClick={() => void logout()}>
            <LogOut size={17} />
            Sign out
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Trash2 size={17} />
            Delete account
          </Button>
        </div>
        <p className="metadata">
          Account deletion removes records, sessions, assistant conversations,
          and action history from the active database. SQLite pages and existing
          backups can retain remnants; secure physical erasure is not
          guaranteed.
        </p>
      </section>
      {deleting && (
        <Modal title="Delete your account?" onClose={() => setDeleting(false)}>
          <form className="editor-form" onSubmit={deleteAccount}>
            <p className="notice">
              This removes your entire workspace from the active database.
              Export anything you want to keep first. This action cannot be
              undone.
            </p>
            <label className="field">
              <span>Confirm with your password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && <ErrorBox message={error} />}
            <div className="form-actions">
              <Button
                type="button"
                variant="subtle"
                onClick={() => setDeleting(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={busy}>
                Delete account permanently
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
