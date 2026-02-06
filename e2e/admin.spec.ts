import { test, expect } from "@playwright/test";

test("admin route is protected", async ({ page }) => {
	await page.goto("/admin");
	await expect(page).toHaveURL(/\/admin|\/login|\/api\/auth\/signin/);
});

