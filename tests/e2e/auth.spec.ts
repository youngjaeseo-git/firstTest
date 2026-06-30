import { test, expect } from "@playwright/test";

test.describe("Authentication flow", () => {
  test("shows login page when unauthenticated", async ({ page }) => {
    await page.goto("/");
    // Middleware should redirect to /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /DCIM Manager/i })).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("logs in successfully with seeded admin credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@dcim.local");
    await page.getByLabel(/password/i).fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Dashboard should appear
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });
});

test.describe("Navigation (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each navigation test
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@dcim.local");
    await page.getByLabel(/password/i).fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/");
  });

  test("can navigate to Servers page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: /^servers$/i }).first().click();
    await expect(page).toHaveURL(/\/servers/);
    await expect(page.getByRole("heading", { name: /^servers$/i })).toBeVisible();
  });

  test("can navigate to Infrastructure page", async ({ page }) => {
    await page.getByRole("link", { name: /infrastructure/i }).first().click();
    await expect(page).toHaveURL(/\/infrastructure/);
  });

  test("command palette opens with ⌘K and closes with Escape", async ({
    page,
  }) => {
    // Open palette
    await page.keyboard.press("Meta+k");
    await expect(page.getByPlaceholder(/search servers, racks, alerts/i)).toBeVisible();

    // Close palette
    await page.keyboard.press("Escape");
    await expect(
      page.getByPlaceholder(/search servers, racks, alerts/i),
    ).not.toBeVisible();
  });
});
