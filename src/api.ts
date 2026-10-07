export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Steward-Request": "1",
      ...options.headers,
    },
    credentials: "same-origin",
  });
  const body = await res.json();
  if (!res.ok)
    throw new Error(body.error ?? "The workspace is unavailable. Try again.");
  return body;
}
export const post = <T = any>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export function formatDate(
  value: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: timezone,
  }).format(new Date(value));
}
export function dayKey(value: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function localInput(value: string, timezone: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (name: string) => p.find((x) => x.type === name)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export async function inputInstant(value: string) {
  const [date, time] = value.split("T");
  return (await post<{ instant: string }>("/local-time", { date, time }))
    .instant;
}
