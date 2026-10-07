import { createApp } from "./app.js";
import express from "express";
import { resolve } from "node:path";
import { openAIBlockedReason } from "./network.js";
const production = process.argv.includes("--production");
const { app, store } = createApp({
  database: process.env.DATABASE_PATH ?? "data/steward.sqlite",
  production,
  trustProxy: process.env.TRUST_PROXY === "true",
  aiBlockedReason: openAIBlockedReason(),
});
if (production) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const host = process.env.HOST ?? "127.0.0.1",
  port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, host, () =>
  console.log(`Steward is running at http://${host}:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
