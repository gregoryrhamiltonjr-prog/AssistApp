import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const signup = async (page) => {
  await page.goto("/");
  await page.getByLabel("Your name").fill("Taylor");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`ui-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-ui-password-123!");
  await page.getByLabel("Your timezone").fill("America/New_York");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Good.*Taylor/ }),
  ).toBeVisible();
};
test("reminder, assistant approval, persistence, event conflict, and Life follow-up journey", async ({
  page,
}) => {
  await signup(page);
  await page
    .getByLabel("Quick reminder", { exact: true })
    .fill("Renew insurance");
  await page.getByRole("button", { name: "Add quick reminder" }).click();
  await expect(
    page.getByRole("heading", { name: "Renew insurance" }),
  ).toBeVisible();
  await page
    .locator('nav[aria-label="Primary navigation"]')
    .getByRole("button", { name: "Plan", exact: true })
    .click();
  await page.getByRole("tab", { name: /Reminders/ }).click();
  await expect(
    page.getByRole("button", { name: /Renew insurance.*No deadline/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Renew insurance" }),
  ).toBeVisible();
  await page
    .locator('nav[aria-label="Primary navigation"]')
    .getByRole("button", { name: /Ask/ })
    .click();
  await page
    .getByLabel("Ask Steward")
    .fill("Remind me to call Grandma tomorrow");
  await page.getByRole("button", { name: "Send command" }).click();
  await expect(
    page.getByRole("button", { name: "Approve change" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve change" }).click();
  await expect(
    page.getByRole("button", { name: "Approve change" }),
  ).toHaveCount(0);
  await page
    .locator('nav[aria-label="Primary navigation"]')
    .getByRole("button", { name: "Plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Work meeting");
  await page.getByLabel("Starts · America/New_York").fill("2026-10-07T09:00");
  await page.getByLabel("Ends", { exact: true }).fill("2026-10-07T10:00");
  await page
    .getByRole("button", { name: "Add event", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Dentist");
  await page.getByLabel("Starts · America/New_York").fill("2026-10-07T09:30");
  await page.getByLabel("Ends", { exact: true }).fill("2026-10-07T10:30");
  await page
    .getByRole("button", { name: "Add event", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: /Work meeting overlaps Dentist/ }),
  ).toBeVisible();
  await page
    .locator('nav[aria-label="Primary navigation"]')
    .getByRole("button", { name: "Life", exact: true })
    .click();
  await page.getByRole("button", { name: /People The people/ }).click();
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Jordan");
  await page
    .getByRole("button", { name: "Add person", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Draft follow-up reminder" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Draft follow-up reminder" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Reach out to Jordan",
  );
  await page.getByRole("button", { name: "Add reminder", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "work/life-desktop.png", fullPage: true });
  await page
    .locator('nav[aria-label="Primary navigation"]')
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await page.screenshot({ path: "work/today-desktop.png", fullPage: true });
});
test("mobile navigation, persisted handoff, keyboard modal, reduced motion and light appearance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signup(page);
  await page
    .locator('nav[aria-label="Mobile navigation"]')
    .getByRole("button", { name: "Discover", exact: true })
    .click();
  await page.getByLabel("Discovery destination").fill("Miami");
  await page.getByRole("button", { name: "Prepare provider search" }).click();
  await expect(
    page.getByRole("link", { name: "Open OpenTable" }),
  ).toHaveAttribute("href", "https://www.opentable.com/s?term=Miami");
  await page.getByRole("button", { name: "Save research link" }).click();
  await expect(
    page.getByText("OpenTable · provider handoff · unverified"),
  ).toBeVisible();
  await page
    .locator('nav[aria-label="Mobile navigation"]')
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await page.getByRole("button", { name: "Quick add" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Use light appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: "work/today-mobile.png", fullPage: true });
});
test("form failures preserve input and focus is trapped inside dialogs", async ({
  page,
}) => {
  await signup(page);
  await page.getByRole("button", { name: "Quick add" }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Invalid interval");
  await page.getByLabel("Starts · America/New_York").fill("2026-10-07T11:00");
  await page.getByLabel("Ends", { exact: true }).fill("2026-10-07T10:00");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "End must be after start",
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Invalid interval",
  );
  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: "Close dialog" }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
test("all primary views pass automated accessibility checks in dark and light appearances", async ({
  page,
}) => {
  await signup(page);
  for (const appearance of ["dark", "light"]) {
    if (appearance === "light")
      await page.getByRole("button", { name: "Use light appearance" }).click();
    for (const tab of ["Today", "Plan", "Ask", "Discover", "Life"]) {
      await page
        .locator('nav[aria-label="Primary navigation"]')
        .getByRole("button", { name: new RegExp("^" + tab) })
        .click();
      const report = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        report.violations,
        `${tab} ${appearance}: ${JSON.stringify(report.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
      ).toEqual([]);
    }
  }
});
test("primary mobile views remain usable at 200 percent text enlargement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page);
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  for (const tab of ["Today", "Plan", "Ask", "Discover", "Life"]) {
    await page
      .locator('nav[aria-label="Mobile navigation"]')
      .getByRole("button", { name: tab, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `${tab} overflow`,
    ).toBe(true);
  }
});
test("an explicit UTC offset disambiguates the repeated daylight-saving hour", async ({
  page,
}) => {
  await signup(page);
  await page.getByRole("button", { name: "Quick add" }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Early repeated hour");
  await page.getByLabel("Use explicit UTC offsets").check();
  await page
    .getByLabel("Starts · America/New_York")
    .fill("2026-11-01T01:30:00-04:00");
  await page
    .getByLabel("Ends", { exact: true })
    .fill("2026-11-01T01:45:00-04:00");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const response = await page.request.get("/api/state");
  const state = await response.json();
  expect(
    state.records.find((r) => r.data.title === "Early repeated hour").data
      .start,
  ).toBe("2026-11-01T01:30:00-04:00");
});
test("Life records, payment status, explicit memory, wellness provenance and automation dry run persist", async ({
  page,
}) => {
  await signup(page);
  await page
    .locator('nav[aria-label="Primary navigation"]')
    .getByRole("button", { name: "Life", exact: true })
    .click();
  await page.getByRole("button", { name: /Money Keep obligations/ }).click();
  await page.getByRole("button", { name: "Add bill", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Phone plan");
  await page.getByLabel("Amount", { exact: true }).fill("45");
  await page.getByLabel("Deadline · America/New_York").fill("2026-10-08T18:00");
  await page
    .getByRole("button", { name: "Add bill", exact: true })
    .last()
    .click();
  await expect(page.getByText("$45.00", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Complete Phone plan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen Phone plan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to Life" }).click();
  await page
    .getByRole("button", { name: /Health & wellness A little/ })
    .click();
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Last night");
  await page.getByLabel("Measured value").fill("7.1");
  await page.getByLabel("Unit", { exact: true }).fill("hours");
  await page
    .getByRole("button", { name: "Add wellness entry", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "7.1 hours" })).toBeVisible();
  await expect(page.getByText(/Sleep · Manual entry/)).toBeVisible();
  await page.getByRole("button", { name: "Back to Life" }).click();
  await page
    .getByRole("button", { name: /Assistant memory Preferences/ })
    .click();
  await page
    .getByRole("button", { name: "Add preference", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Preferred workout");
  await page.getByLabel("Preference details").fill("I prefer mornings");
  await page.getByRole("button", { name: "Add memory", exact: true }).click();
  await page
    .getByRole("button", { name: "Disable memory", exact: true })
    .click();
  await expect(page.getByText(/Assistant memory is disabled/)).toBeVisible();
  await page.getByRole("button", { name: "Back to Life" }).click();
  await page.getByRole("button", { name: /Automations Consider/ }).click();
  await page
    .getByRole("button", { name: "Add automation", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Morning review");
  await page
    .getByRole("button", { name: "Add automation", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Dry run", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "No changes were executed",
  );
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  const response = await page.request.get("/api/state");
  const state = await response.json();
  expect(
    state.records.find((r) => r.data.title === "Phone plan").data.status,
  ).toBe("paid");
  expect(
    state.records.find((r) => r.data.title === "Last night").data.source,
  ).toBe("manual");
  expect(state.user.memoryEnabled).toBe(false);
  expect(state.actions.length).toBe(0);
});
