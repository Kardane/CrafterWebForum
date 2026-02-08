import { test, expect } from "@playwright/test";

test("home page redirects unauthenticated user to login", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveURL(/\/login(\?|$)/);
});

test("signin endpoint is reachable", async ({ page }) => {
	await page.goto("/api/auth/signin");
	await expect(page).toHaveURL(/\/api\/auth\/signin|\/login/);
});
