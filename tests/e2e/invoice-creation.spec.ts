import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
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
      page.getByLabel("Inhaber / vollständiger Firmenname"),
    ).toHaveValue("Daniel Ecklkofer & Oliver Schöfberger GbR");
    await expect(
      page.getByLabel("Absender: Straße und Hausnummer"),
    ).toHaveValue("St.-Emmeram-Str. 2");
    await expect(page.getByLabel("Steuernummer", { exact: true })).toHaveValue(
      "11316700308",
    );
    await page
      .getByLabel("Absender: Straße und Hausnummer")
      .fill("Neue Straße 12");
    await page.getByLabel("Absender: PLZ und Ort").fill("84503 Altötting");
    await page
      .getByLabel("Steuernummer", { exact: true })
      .fill("113/167/00308");
    await page.getByText("Bankdaten bearbeiten", { exact: true }).click();
    await expect(page.getByLabel("IBAN", { exact: true })).toHaveValue(
      "DE16740618130005498473",
    );
    await page.getByLabel("Bankname", { exact: true }).fill("Andere Testbank");
    await page
      .getByLabel("IBAN", { exact: true })
      .fill("DE89370400440532013000");
    await page.getByLabel("BIC", { exact: true }).fill("COBADEFFXXX");
    await expect(
      page.getByText("Gesamtbetrag: 500,00 EUR", { exact: true }),
    ).toBeVisible();
    const previewResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/invoice-documents/preview") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "PDF-Vorschau", exact: true })
      .click();
    const rendered = await previewResponse;
    expect(rendered.status()).toBe(200);
    expect(rendered.headers()["content-type"]).toContain("application/pdf");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("iframe")).toHaveAttribute("src", /^blob:/);
    const previewUrl = await dialog.locator("iframe").getAttribute("src");
    // Read the same Blob the PDF viewer receives. Edge's PDF handler can omit
    // the network body from the DevTools response cache.
    const pdfBytes = await page.evaluate(
      async (url) =>
        Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
      previewUrl,
    );
    expect(pdfBytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(pdfBytes).subarray(0, 5).toString()).toBe("%PDF-");
    await writeFile(
      "test-results/custom-sender-preview.pdf",
      Buffer.from(pdfBytes),
    );
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
