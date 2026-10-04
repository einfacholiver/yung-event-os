import { expect, test } from "@playwright/test";

test("foundation renders without runtime services", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("YUNG Event OS");
  await expect(
    page.getByRole("heading", { level: 1, name: "YUNG Event OS" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  expect(errors).toEqual([]);
});
