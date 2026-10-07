import { useState } from "react";
import {
  Utensils,
  Plane,
  BedDouble,
  CarFront,
  Ticket,
  ExternalLink,
  Bookmark,
  Search,
  Compass,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "./context";
import { Badge, Button, Empty, ErrorBox } from "./components";
import { post } from "./api";
const categories = [
  {
    id: "restaurants",
    title: "Dining",
    icon: Utensils,
    provider: "OpenTable",
    description: "Find a table worth making time for.",
  },
  {
    id: "flights",
    title: "Flights",
    icon: Plane,
    provider: "Google Flights",
    description: "Explore routes for your next chapter.",
  },
  {
    id: "hotels",
    title: "Stays",
    icon: BedDouble,
    provider: "Booking.com",
    description: "Find a place that feels right.",
  },
  {
    id: "transport",
    title: "Getting around",
    icon: CarFront,
    provider: "Google Maps",
    description: "Bring the journey into your plans.",
  },
  {
    id: "activities",
    title: "Experiences",
    icon: Ticket,
    provider: "Eventbrite",
    description: "Make room for something memorable.",
  },
];
function providerUrl(category: string, destination: string) {
  const q = encodeURIComponent(destination);
  return category === "restaurants"
    ? `https://www.opentable.com/s?term=${q}`
    : category === "flights"
      ? `https://www.google.com/travel/flights?q=${encodeURIComponent("Flights to " + destination)}`
      : category === "hotels"
        ? `https://www.booking.com/searchresults.html?ss=${q}`
        : category === "transport"
          ? `https://www.google.com/maps/search/?api=1&query=${q}`
          : `https://www.eventbrite.com/d/online/all-events/?q=${q}`;
}
export function Discover() {
  const { state, refresh, remove, notify } = useWorkspace();
  const [category, setCategory] = useState("restaurants"),
    [destination, setDestination] = useState(""),
    [result, setResult] = useState<{
      url: string;
      destination: string;
      category: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = categories.find((c) => c.id === category)!;
  const saved = state.records.filter((r) => r.kind === "bookings");
  async function save() {
    if (!result) return;
    setBusy(true);
    try {
      const provider = categories.find((c) => c.id === result.category)!;
      await post("/records/bookings", {
        title: `${provider.title} · ${result.destination}`,
        category: result.category,
        provider: provider.provider,
        handoffUrl: result.url,
        status: "provider_handoff",
      });
      await refresh();
      notify("Research link saved. No booking was made.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A LITTLE POSSIBILITY</p>
          <h1>
            Discover your next<span className="lime">.</span>
          </h1>
          <p className="heading-note">
            Find the right provider. Keep your plans together.
          </p>
        </div>
        <Badge>Provider handoffs</Badge>
      </div>
      <div className="discovery-categories">
        {categories.map((c) => (
          <button
            className={category === c.id ? "active" : ""}
            onClick={() => {
              setCategory(c.id);
              setResult(null);
            }}
            key={c.id}
          >
            <c.icon size={23} />
            <span>{c.title}</span>
          </button>
        ))}
      </div>
      <section className="discover-surface">
        <div className="discover-intro">
          <span className="discover-icon">
            <current.icon size={32} />
          </span>
          <p className="eyebrow">{current.provider.toUpperCase()}</p>
          <h2>{current.description}</h2>
          <p>
            Open a real provider to check availability, prices, and policies.
            Checkout happens directly with the provider.
          </p>
        </div>
        <form
          className="discovery-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (destination.trim())
              setResult({
                url: providerUrl(category, destination.trim()),
                destination: destination.trim(),
                category,
              });
          }}
        >
          <label className="field">
            <span>
              {category === "transport"
                ? "Where do you want to go?"
                : "City, destination, or place"}
            </span>
            <div className="search-input">
              <Search size={18} />
              <input
                aria-label="Discovery destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={
                  category === "restaurants"
                    ? "A city, neighborhood, or restaurant"
                    : "Where are you thinking?"
                }
                required
                maxLength={200}
              />
            </div>
          </label>
          <Button type="submit">
            <Compass size={17} />
            Prepare provider search
          </Button>
          <p className="metadata">No provider account is connected.</p>
        </form>
      </section>
      {result && (
        <section className="panel handoff-result">
          <div>
            <Badge tone="amber">Checkout requires provider handoff</Badge>
            <h3>
              {categories.find((c) => c.id === result.category)?.title} in{" "}
              {result.destination}
            </h3>
            <p>
              This is a search link. Live availability, pricing, and booking
              confirmation have not been retrieved.
            </p>
          </div>
          <div>
            <a
              className="button"
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {categories.find((c) => c.id === result.category)?.provider}
              <ExternalLink size={16} />
            </a>
            <Button variant="subtle" disabled={busy} onClick={save}>
              <Bookmark size={16} />
              {busy ? "Saving…" : "Save research link"}
            </Button>
          </div>
        </section>
      )}
      {error && <ErrorBox message={error} />}
      <section className="panel saved-research">
        <div className="section-head">
          <div>
            <Bookmark size={18} />
            <h2>Saved possibilities</h2>
            <Badge>{saved.length}</Badge>
          </div>
        </div>
        {saved.length ? (
          saved.map((r) => (
            <div key={r.id} className="research-row">
              <span className="shortcut-icon travel">
                <Compass size={19} />
              </span>
              <div>
                <strong>{r.data.title}</strong>
                <p>{r.data.provider} · provider handoff · unverified</p>
              </div>
              <a
                className="button small subtle"
                href={r.data.handoffUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open provider
                <ExternalLink size={14} />
              </a>
              <button
                className="icon-button danger-hover"
                aria-label={`Delete ${r.data.title}`}
                onClick={() => remove(r)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            icon={Bookmark}
            title="Keep the possibilities close"
            text="Save a provider search so you can return to it. Search links are never shown as confirmed reservations."
          />
        )}
      </section>
      <div className="trust-strip">
        <ShieldCheck size={19} />
        <p>
          Reservations are confirmed only by a provider. Steward cannot submit,
          cancel, pay for, or verify bookings in this version.
        </p>
      </div>
    </>
  );
}
