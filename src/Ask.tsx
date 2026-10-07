import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Mic,
  ShieldCheck,
  History,
  Check,
  Clock3,
} from "lucide-react";
import { useWorkspace } from "./context";
import { ActionCard, Badge, Button, ErrorBox, Empty } from "./components";
import { post } from "./api";
export function Ask({
  initial,
  clearInitial,
}: {
  initial: string;
  clearInitial: () => void;
}) {
  const { state, refresh, action } = useWorkspace();
  const [text, setText] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initial) {
      setText(initial);
      clearInitial();
    }
  }, [initial, clearInitial]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [state.messages.length]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await post("/assistant", { text });
      setText("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  const actions = state.actions.filter(
    (a) => history || a.status === "proposed",
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THINK LESS. MAKE ROOM.</p>
          <h1>
            Your assistant<span className="lime">.</span>
          </h1>
          <p className="heading-note">
            A thought, a plan, a little more headspace.
          </p>
        </div>
        <Badge tone={state.aiAvailable ? "green" : "amber"}>
          {state.aiAvailable
            ? "OpenAI configured"
            : state.aiConfigured
              ? "Key configured · Live AI blocked"
              : "Local commands · Live AI unavailable"}
        </Badge>
      </div>
      <div className="ask-layout">
        <section className="conversation panel">
          <div className="conversation-top">
            <span className="assistant-symbol">✦</span>
            <div>
              <strong>Steward</strong>
              <span>
                {state.aiAvailable
                  ? "Plans prepared with AI, executed by verified tools"
                  : "Saved-data summaries and supported local commands"}
              </span>
            </div>
            <ShieldCheck size={19} />
          </div>
          {!state.aiAvailable && (
            <p className="notice ai-notice">
              {state.aiBlockedReason ??
                "No OpenAI key is configured. Local commands work below. Free-form AI reasoning is unavailable."}
            </p>
          )}
          <div className="messages" aria-live="polite">
            {state.messages.length ? (
              state.messages.map((m) => (
                <div className={`message ${m.role}`} key={m.id}>
                  {m.role === "assistant" && (
                    <span className="message-avatar">✦</span>
                  )}
                  <div>
                    <span className="message-author">
                      {m.role === "user" ? "You" : "Steward"}
                    </span>
                    <p>{m.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="ask-welcome">
                <span className="large-star">✦</span>
                <h2>What's on your mind?</h2>
                <p>
                  Start with one small thing. Review each change before it
                  becomes part of your day.
                </p>
                <div className="prompt-grid">
                  {[
                    "Remind me to plan my week tomorrow",
                    "Schedule workout tomorrow at 9am for 60 minutes",
                    "Summarize my day",
                    "Help",
                  ].map((s) => (
                    <button key={s} onClick={() => setText(s)}>
                      <Sparkles size={16} />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {busy && (
              <div className="thinking">
                <span />
                <span />
                <span />
                Preparing your request…
              </div>
            )}
            <div ref={bottom} />
          </div>
          {error && <ErrorBox message={error} />}
          <form className="composer" onSubmit={submit}>
            <textarea
              aria-label="Ask Steward"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy) void submit(e);
                }
              }}
              rows={2}
              placeholder="Ask Steward or enter a local command…"
              maxLength={3000}
            />
            <div>
              <span>
                <ShieldCheck size={14} />
                Your permission. Your control.
              </span>
              <Button
                type="submit"
                disabled={busy || !text.trim()}
                aria-label="Send command"
              >
                <Send size={17} />
                {busy ? "Preparing…" : "Send"}
              </Button>
            </div>
          </form>
        </section>
        <aside className="approval-sidebar">
          <div className="section-head">
            <div>
              <History size={18} />
              <h2>{history ? "Action history" : "Review queue"}</h2>
            </div>
          </div>
          <div className="segmented">
            <button
              className={!history ? "active" : ""}
              onClick={() => setHistory(false)}
            >
              Pending
            </button>
            <button
              className={history ? "active" : ""}
              onClick={() => setHistory(true)}
            >
              History
            </button>
          </div>
          {actions.length ? (
            actions.map((a) => (
              <ActionCard
                key={a.id}
                action={a}
                user={state.user}
                onAction={action}
              />
            ))
          ) : (
            <Empty
              icon={ShieldCheck}
              title="You're in control"
              text="Prepared actions appear here. A verified tool result is required before an action is marked completed."
            />
          )}
          <div className="permission-note">
            <ShieldCheck size={20} />
            <strong>
              {
                (
                  {
                    observe: "Observe only",
                    suggest: "Suggest only",
                    approval: "Act with approval",
                    autopilot: "Limited reminder autopilot",
                  } as const
                )[state.user.autonomy]
              }
            </strong>
            <p>
              {state.user.autonomy === "autopilot"
                ? "Only creating and completing reminders are preapproved. Other supported changes require approval."
                : "No payments, messages, bookings, or device operations can be executed by this assistant."}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
