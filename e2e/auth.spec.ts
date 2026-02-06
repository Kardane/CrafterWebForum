import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveTitle(/CrafterForum|Crafter/);
});

test("signin endpoint is reachable", async ({ page }) => {
	await page.goto("/api/auth/signin");
	await expect(page).toHaveURL(/\/api\/auth\/signin|\/login/);
});
