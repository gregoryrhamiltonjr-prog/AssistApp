import { performance } from "node:perf_hooks";
import { Store } from "../server/store.js";
const store = new Store(":memory:");
const user = store.register({
  email: "benchmark@example.com",
  password: "benchmark-password-only",
  name: "Synthetic benchmark",
  timezone: "America/New_York",
});
store.transaction(() => {
  for (let i = 0; i < 1000; i++)
    store.create(user.id, "tasks", {
      title: `Synthetic task ${i}`,
      due: "2026-10-07T18:00:00Z",
    });
});
const times = [];
for (let i = 0; i < 30; i++) {
  const start = performance.now();
  const result = store.list(user.id);
  if (result.length !== 1000) throw new Error("Unexpected record count");
  times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      workload: "Read and decrypt 1000 synthetic reminders",
      iterations: times.length,
      p50Ms: Number(times[15].toFixed(2)),
      p95Ms: Number(times[28].toFixed(2)),
      notes:
        "In-memory SQLite in this environment; excludes disk, network, client rendering, and password hashing.",
    },
    null,
    2,
  ),
);
store.close();
