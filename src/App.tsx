import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sun,
  CalendarDays,
  Sparkles,
  Compass,
  LayoutGrid,
  Search,
  Plus,
  ChevronRight,
  X,
  Moon,
  LogOut,
  RefreshCw,
  Check,
  ArrowUpRight,
  ShieldCheck,
  Menu,
  WifiOff,
} from "lucide-react";
import {
  type State,
  type User,
  type Tab,
  type Kind,
  type Entity,
} from "./types";
import { api, post, dayKey, formatDate } from "./api";
import { WorkspaceContext } from "./context";
import { Button, Empty, ErrorBox, Modal, RecordEditor } from "./components";
import { Today } from "./Today";
import { Plan } from "./Plan";
import { Ask } from "./Ask";
import { Discover } from "./Discover";
import { Life } from "./Life";

const nav = [
  { tab: "Today", icon: Sun },
  { tab: "Plan", icon: CalendarDays },
  { tab: "Ask", icon: Sparkles },
  { tab: "Discover", icon: Compass },
  { tab: "Life", icon: LayoutGrid },
] as const;
export function App() {
  const [state, setState] = useState<State | null>(null),
    [session, setSession] = useState<User | null | undefined>(undefined),
    [tab, setTab] = useState<Tab>("Today"),
    [now, setNow] = useState(new Date()),
    [initial, setInitial] = useState("");
  const [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [editor, setEditor] = useState<{ kind: Kind; record?: Entity } | null>(
      null,
    ),
    [deleting, setDeleting] = useState<Entity | null>(null),
    [busy, setBusy] = useState(false),
    [searching, setSearching] = useState(false),
    [query, setQuery] = useState(""),
    [adding, setAdding] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [theme, setTheme] = useState(
      localStorage.getItem("steward-theme") ?? "dark",
    );
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const next = await api<State>("/state");
      setState(next);
      setSession(next.user);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);
  useEffect(() => {
    void api<{ user: User | null }>("/session")
      .then((s) => {
        setSession(s.user);
        if (s.user) void refresh().catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("steward-theme", theme);
  }, [theme]);
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearching(true);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const edit = useCallback(
    (kind: Kind, record?: Entity) => setEditor({ kind, record }),
    [],
  );
  const closeEditor = useCallback(() => setEditor(null), []);
  const go = useCallback((next: Tab) => {
    setTab(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const ask = useCallback(
    (text: string) => {
      setInitial(text);
      go("Ask");
    },
    [go],
  );
  const clearInitial = useCallback(() => setInitial(""), []);
  async function update(r: Entity, patch: Record<string, any>) {
    try {
      await api("/records/" + r.id, {
        method: "PATCH",
        body: JSON.stringify({
          data: { ...r.data, ...patch },
          revision: r.revision,
        }),
      });
      await refresh();
    } catch (e) {
      notify((e as Error).message);
      throw e;
    }
  }
  async function toggle(r: Entity) {
    if (!["tasks", "bills"].includes(r.kind)) return;
    const field = r.kind === "tasks" ? "completed" : "paid",
      open = r.kind === "tasks" ? "open" : "due";
    try {
      await update(r, { status: r.data.status === field ? open : field });
      notify(
        r.data.status === field
          ? "Item reopened."
          : "Status saved. You can reopen it.",
      );
    } catch {
      /* update already shows the error */
    }
  }
  async function action(id: string, op: string) {
    try {
      await post(`/actions/${id}/${op}`);
      await refresh();
      notify(
        op === "approve"
          ? "Change completed and verified."
          : "Proposal dismissed.",
      );
    } catch (e) {
      await refresh();
      throw e;
    }
  }
  async function deleteRecord() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api("/records/" + deleting.id, {
        method: "DELETE",
        body: JSON.stringify({ revision: deleting.revision }),
      });
      setDeleting(null);
      await refresh();
      notify("Item deleted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (session === undefined)
    return (
      <div className="boot">
        <div className="brand-mark">✦</div>
        <h1>Steward</h1>
        {error ? (
          <>
            <ErrorBox message={error} />
            <Button onClick={() => location.reload()}>Retry</Button>
          </>
        ) : (
          <p>Opening your workspace…</p>
        )}
      </div>
    );
  if (session === null)
    return (
      <Auth
        onAuthenticated={async () => {
          await refresh();
        }}
      />
    );
  if (!state)
    return (
      <div className="boot">
        <div className="brand-mark">✦</div>
        <p>Loading your plans…</p>
        {error && (
          <>
            <ErrorBox message={error} />
            <Button onClick={() => void refresh().catch(() => {})}>
              Try again
            </Button>
          </>
        )}
      </div>
    );
  const filtered = state.records
    .filter((r) => r.data.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);
  return (
    <WorkspaceContext.Provider
      value={{
        state,
        now,
        refresh,
        edit,
        remove: setDeleting,
        toggle,
        notify,
        go,
        ask,
        action,
        update,
      }}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
          <button
            className="brand"
            onClick={() => go("Today")}
            aria-label="Steward home"
          >
            <span className="brand-mark">✦</span>
            <span>
              steward<span className="brand-period">.</span>
            </span>
          </button>
          <div className="workspace-label">YOUR PERSONAL SPACE</div>
          <nav aria-label="Primary navigation">
            {nav.map((n) => (
              <button
                key={n.tab}
                className={`nav-item ${tab === n.tab ? "active" : ""}`}
                onClick={() => go(n.tab)}
                aria-current={tab === n.tab ? "page" : undefined}
              >
                <n.icon size={20} />
                <span>{n.tab}</span>
                {n.tab === "Ask" && <span className="nav-ai">✦</span>}
                {n.tab === "Today" &&
                  state.actions.some((a) => a.status === "proposed") && (
                    <span className="nav-count">
                      {
                        state.actions.filter((a) => a.status === "proposed")
                          .length
                      }
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-assistant">
              <span>✦</span>
              <strong>
                A little help,
                <br />a lot of headspace.
              </strong>
              <button onClick={() => go("Ask")}>
                Ask Steward
                <ArrowUpRight size={15} />
              </button>
            </div>
            <button className="profile" onClick={() => go("Life")}>
              <span className="avatar">{state.user.name[0].toUpperCase()}</span>
              <span>
                <strong>{state.user.name}</strong>
                <small>Your private workspace</small>
              </span>
              <ChevronRight size={15} />
            </button>
          </div>
        </aside>
        <div className="app-content">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu icon-button"
                aria-label="Toggle navigation"
                onClick={() => setMobileMenu(!mobileMenu)}
              >
                <Menu size={20} />
              </button>
              <span>Your workspace</span>
              <ChevronRight size={13} />
              <strong>{tab}</strong>
            </div>
            <div className="topbar-actions">
              <button
                className="global-search"
                onClick={() => setSearching(true)}
              >
                <Search size={17} />
                <span>Find anything</span>
                <kbd>⌘ K</kbd>
              </button>
              <button
                className="icon-button theme-toggle"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={`Use ${theme === "dark" ? "light" : "dark"} appearance`}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <Button variant="small" onClick={() => setAdding(true)}>
                <Plus size={17} />
                <span>Quick add</span>
              </Button>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {error && (
              <div className="stale-banner" role="alert">
                <WifiOff size={19} />
                <span>{error} Showing the last loaded workspace.</span>
                <button onClick={() => void refresh().catch(() => {})}>
                  <RefreshCw size={15} />
                  Retry
                </button>
              </div>
            )}
            {tab === "Today" ? (
              <Today />
            ) : tab === "Plan" ? (
              <Plan />
            ) : tab === "Ask" ? (
              <Ask initial={initial} clearInitial={clearInitial} />
            ) : tab === "Discover" ? (
              <Discover />
            ) : (
              <Life
                onLogout={() => {
                  setState(null);
                  setSession(null);
                  setTab("Today");
                }}
              />
            )}
            <footer className="workspace-footer">
              <span>
                <ShieldCheck size={13} />
                Local workspace · no connected services
              </span>
              <span>
                {formatDate(state.sync.lastRead, state.user.timezone, {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                last loaded
              </span>
            </footer>
          </main>
        </div>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {nav.map((n) => (
            <button
              key={n.tab}
              className={tab === n.tab ? "active" : ""}
              onClick={() => go(n.tab)}
              aria-current={tab === n.tab ? "page" : undefined}
            >
              <n.icon size={21} />
              <span>{n.tab}</span>
            </button>
          ))}
        </nav>
      </div>
      {editor && (
        <RecordEditor
          kind={editor.kind}
          record={editor.record}
          user={state.user}
          onClose={closeEditor}
          onSaved={refresh}
        />
      )}
      {deleting && (
        <Modal title="Delete this item?" onClose={() => setDeleting(null)}>
          <p className="modal-copy">
            “{deleting.data.title}” will be removed from your workspace. This
            cannot be undone.
          </p>
          {error && <ErrorBox message={error} />}
          <div className="form-actions">
            <Button variant="subtle" onClick={() => setDeleting(null)}>
              Keep item
            </Button>
            <Button variant="danger" disabled={busy} onClick={deleteRecord}>
              {busy ? "Deleting…" : "Delete item"}
            </Button>
          </div>
        </Modal>
      )}
      {adding && (
        <Modal title="Make a little room" onClose={() => setAdding(false)}>
          <p className="modal-copy">What would you like to add?</p>
          <div className="quick-add-grid">
            {[
              { kind: "tasks", label: "Reminder", icon: Check },
              { kind: "events", label: "Event", icon: CalendarDays },
              { kind: "people", label: "Person", icon: Plus },
              { kind: "bills", label: "Bill", icon: ShieldCheck },
              { kind: "routines", label: "Routine", icon: RefreshCw },
              { kind: "trips", label: "Trip", icon: Compass },
            ].map((x) => (
              <button
                key={x.kind}
                onClick={() => {
                  setAdding(false);
                  edit(x.kind as Kind);
                }}
              >
                <x.icon size={22} />
                {x.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {searching && (
        <Modal title="Find anything" onClose={() => setSearching(false)} wide>
          <div className="search-input">
            <Search size={18} />
            <input
              placeholder="Search your saved workspace…"
              aria-label="Global search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="search-results">
            {filtered.length ? (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSearching(false);
                    edit(r.kind, r);
                  }}
                >
                  <div>
                    <strong>{r.data.title}</strong>
                    <span>{r.kind}</span>
                  </div>
                  <ChevronRight size={17} />
                </button>
              ))
            ) : (
              <Empty
                icon={Search}
                title="No matches yet"
                text="Try another title or add something to your workspace."
              />
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
function Auth({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [register, setRegister] = useState(true),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [timezone, setTimezone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(
        "/auth/" + (register ? "register" : "login"),
        register ? { name, email, password, timezone } : { email, password },
      );
      await onAuthenticated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark">✦</span>steward
        <span className="lime">.</span>
      </div>
      <div className="auth-layout">
        <section className="auth-story">
          <p className="eyebrow">YOUR PERSONAL OPERATING SYSTEM</p>
          <h1>
            A little clarity.
            <br />A lot more life.
          </h1>
          <p>
            One thoughtful space for your day, your plans, and the people and
            details that matter.
          </p>
          <div className="auth-features">
            <span>
              <CalendarDays size={18} />A day that comes together
            </span>
            <span>
              <Sparkles size={18} />
              An assistant you control
            </span>
            <span>
              <ShieldCheck size={18} />A workspace that's yours
            </span>
          </div>
          <div className="auth-art" aria-hidden="true">
            ✦
          </div>
        </section>
        <section className="auth-card">
          <div className="auth-card-heading">
            <span className="assistant-symbol">✦</span>
            <h2>{register ? "Make yourself at home." : "Welcome back."}</h2>
            <p>
              {register
                ? "Create your private local workspace."
                : "Sign in to pick up where you left off."}
            </p>
          </div>
          <form onSubmit={submit} className="editor-form">
            {register && (
              <label className="field">
                <span>Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                  autoComplete="given-name"
                  placeholder="What should we call you?"
                />
              </label>
            )}
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="At least 12 characters"
              />
            </label>
            {register && (
              <label className="field">
                <span>Your timezone</span>
                <input
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  list="auth-zones"
                />
                <datalist id="auth-zones">
                  {Intl.supportedValuesOf("timeZone").map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </label>
            )}
            {error && <ErrorBox message={error} />}
            <Button type="submit" disabled={busy}>
              {busy
                ? "Opening your workspace…"
                : register
                  ? "Create workspace"
                  : "Sign in"}
            </Button>
          </form>
          <p className="auth-switch">
            {register ? "Already have a workspace?" : "New to Steward?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create one"}
            </button>
          </p>
          <p className="auth-privacy">
            Stored on this server. No sample data or connected accounts. Live AI
            is unavailable until a key is configured.
          </p>
        </section>
      </div>
      <footer>Thoughtfully organized. Entirely yours.</footer>
    </div>
  );
}
