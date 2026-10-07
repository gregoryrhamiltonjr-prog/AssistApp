import { defineConfig } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
mkdirSync("work", { recursive: true });
export default defineConfig({
  testDir: "./tests/ui",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3001",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "PORT=3001 DATABASE_PATH=work/steward-ui.sqlite node server/index.js --production",
    url: "http://127.0.0.1:3001/api/session",
    reuseExistingServer: false,
  },
  reporter: "list",
});
