import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
test.use({ trace: "off" });
test("invoice form and real PDF preview work without issuing an invoice", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.E2E_AUTH_WORKSPACE !== "true",
    "Existing admin/database test must be enabled.",
  );
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
    const before = await db.invoiceDocument.count({
      where: { organizationId: admin.organizationId! },
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
        url: "http://localhost:3100",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:3100/invoices/create");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Rechnungen erstellen",
    );
    await expect(
      page.getByRole("button", {
        name: "Rechnung erstellen & ablegen",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByLabel("Rechnungsempfänger und vollständige Anschrift")
      .fill("Testfirma\nTeststraße 1\n84332 Testort");
    await page
      .getByLabel("Bezeichnung / Veranstaltung")
      .fill("Unverbindlicher Vorschautest");
    await page.getByLabel("Leistungsdatum").fill("2026-10-19");
    await page
      .getByLabel("1. Beschreibung")
      .fill("DJ-Tätigkeit für die Vorschau");
    await page.getByLabel("Einzelpreis in EUR").fill("500,00");
    await expect(
      page.getByText("Gesamtbetrag: 500,00 EUR", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "PDF-Vorschau", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveAttribute("src", /^blob:/);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page
      .getByRole("combobox", { name: "Zahlung", exact: true })
      .selectOption("CASH_PAID");
    await expect(page.getByLabel("Zahlung erhalten am")).toBeVisible();
    await page
      .getByRole("combobox", { name: "PDF speichern unter", exact: true })
      .selectOption("EVENT");
    await expect(
      page.getByRole("combobox", { name: "Event", exact: true }),
    ).toBeVisible();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "test-results/invoice-composer-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "test-results/invoice-composer-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(
      await db.invoiceDocument.count({
        where: { organizationId: admin.organizationId! },
      }),
    ).toBe(before);
  } finally {
    await db.session.deleteMany({ where: { sessionToken: token } });
    await db.$disconnect();
  }
});
