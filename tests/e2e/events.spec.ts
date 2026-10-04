import { expect, test } from "@playwright/test";

test.describe("events module", () => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    "Requires the seeded dedicated PostgreSQL test database.",
  );

  test("opens seeded events and every detail section, including direct links", async ({
    page,
  }) => {
    await page.goto("/events");
    await expect(
      page.getByRole("heading", { level: 1, name: "Events" }),
    ).toBeVisible();
    for (const name of [
      "YUNG Pre-Event",
      "Chapter One",
      "Chapter Two",
      "Chapter Three",
      "Chapter Four",
    ]) {
      await expect(
        page.getByRole("link", { name: name + " öffnen" }),
      ).toBeVisible();
    }
    await page.getByRole("link", { name: "Chapter One öffnen" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Chapter One" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();
    for (const tab of [
      "Finances",
      "Invoices",
      "Documents",
      "Tasks",
      "Media",
      "Permissions",
      "Tickets",
      "Analytics",
    ]) {
      await page.getByRole("link", { name: tab, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: tab, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("In Vorbereitung", { exact: true }),
      ).toBeVisible();
    }
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Analytics", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();
    await page.goto(page.url() + "/unknown-section");
    await expect(
      page.getByText("Event oder Bereich nicht gefunden"),
    ).toBeVisible();
  });

  test("unknown ids show not found", async ({ page }) => {
    await page.goto("/events/event-that-does-not-exist");
    await expect(
      page.getByText("Event oder Bereich nicht gefunden"),
    ).toBeVisible();
  });
});
