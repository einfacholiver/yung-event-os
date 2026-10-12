import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
test.use({ trace: "off" });

test.describe("authenticated workspace review", () => {
  test.skip(
    process.env.E2E_AUTH_WORKSPACE !== "true",
    "Requires an explicitly enabled existing admin/database test.",
  );
  test("event tabs, editor, brand colors and reduced motion work on desktop and mobile", async ({
    page,
    context,
  }) => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const token = randomBytes(32).toString("hex");
    try {
      const admin = await db.user.findFirstOrThrow({
        where: {
          email: "lightsignal.dj@gmail.com",
          organization: { slug: "yung" },
          accounts: {
            some: { provider: "google", providerAccountId: { not: "" } },
          },
        },
      });
      const event = await db.event.findFirstOrThrow({
        where: {
          organizationId: admin.organizationId!,
          name: { contains: "Four", mode: "insensitive" },
        },
      });
      await db.session.create({
        data: {
          userId: admin.id,
          sessionToken: token,
          expires: new Date(Date.now() + 300000),
        },
      });
      await context.addCookies([
        {
          name: "authjs.session-token",
          value: token,
          url: "http://127.0.0.1:3100",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/events/${event.id}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Four",
      );
      await page
        .getByRole("navigation", { name: "Event-Bereiche" })
        .getByRole("link", { name: "Finanzen", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Finanzen", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Bearbeiten", exact: true })
        .first()
        .click();
      const dialog = page.getByRole("dialog", { name: "Buchung bearbeiten" });
      await expect(dialog).toBeVisible();
      await page.screenshot({
        path: "test-results/finance-editor-desktop.png",
        animations: "disabled",
      });
      await expect(
        dialog.getByRole("button", { name: "Speichern", exact: true }),
      ).toHaveCSS("background-color", "rgb(250, 117, 77)");
      await page.setViewportSize({ width: 390, height: 844 });
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
      await dialog
        .getByRole("button", { name: "Speichern", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        dialog.getByRole("button", { name: "Speichern", exact: true }),
      ).toBeInViewport();
      await dialog
        .getByRole("button", { name: "Löschen", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        dialog.getByRole("button", { name: "Löschen", exact: true }),
      ).toBeInViewport();
      await page.screenshot({
        path: "test-results/finance-editor-mobile.png",
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page
        .getByRole("button", { name: "Bearbeiten", exact: true })
        .first()
        .click();
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate((element) =>
          parseFloat(getComputedStyle(element).animationDuration),
        ),
      ).toBeLessThan(0.001);
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 1280, height: 900 });
      await page
        .getByRole("navigation", { name: "Event-Bereiche" })
        .getByRole("link", { name: "Dokumente", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Dokumente", exact: true }),
      ).toBeVisible();
      expect(
        await page.locator('a[href^="https://drive.google.com/file/"]').count(),
      ).toBeLessThanOrEqual(48);
      expect(errors).toEqual([]);
      await page.screenshot({
        path: "test-results/workspace-review.png",
        fullPage: true,
      });
    } finally {
      await db.session.deleteMany({ where: { sessionToken: token } });
      await db.$disconnect();
    }
  });
});
