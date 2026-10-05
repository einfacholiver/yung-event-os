import { expect, test } from "@playwright/test";

for (const path of [
  "/events",
  "/events/private/finances",
  "/documents",
  "/finances",
  "/settings/integrations/google-drive",
]) {
  test(`anonymous access to ${path} requires login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("button", { name: "Mit Google anmelden" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Arbeitsbereiche" }),
    ).toHaveCount(0);
    await expect(page.getByText("Chapter Four", { exact: true })).toHaveCount(
      0,
    );
  });
}
test("direct API requests do not expose data without a session", async ({
  request,
}) => {
  const response = await request.get("/api/finances/transactions");
  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/json");
});
