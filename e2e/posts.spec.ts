import { test, expect } from "@playwright/test";

test("posts new page redirects unauthenticated user flow safely", async ({ page }) => {
	await page.goto("/posts/new");
	await expect(page).toHaveURL(/posts\/new|api\/auth\/signin|login/);
});
