import { expect, test, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const postsEnv = {
	userNickname: process.env.E2E_NOTIFICATION_USER_A_NICKNAME ?? "",
	userPassword: process.env.E2E_NOTIFICATION_USER_A_PASSWORD ?? "",
	postId: process.env.E2E_NOTIFICATION_POST_ID ?? "",
};

const hasPostsE2EEnv =
	Boolean(postsEnv.userNickname) &&
	Boolean(postsEnv.userPassword) &&
	Boolean(postsEnv.postId);

async function login(page: Page, nickname: string, password: string) {
	await page.goto("/login");
	await page.waitForLoadState("networkidle");
	await expect(page.locator("#nickname")).toBeVisible();
	await expect(page.locator("#password")).toBeVisible();
	await page.fill("#nickname", nickname);
	await page.fill("#password", password);
	await page.getByRole("button", { name: "로그인" }).click();
	await expect(page).toHaveURL(/\/$/);
}

async function getBottomGap(page: Page) {
	return page.evaluate(() =>
		Math.max(0, document.documentElement.scrollHeight - (window.scrollY + window.innerHeight))
	);
}

test.describe("posts", () => {
	test("posts new page redirects unauthenticated user flow safely", async ({ page }) => {
		await page.goto("/posts/new");
		await expect(page).toHaveURL(/posts\/new|api\/auth\/signin|login/);
	});

	test.skip(!hasPostsE2EEnv, "포스트 E2E 실행용 승인 유저 계정/포스트 환경변수 필요");

	test("plain detail entry keeps latest comment bottom after mount refresh", async ({ page }) => {
		await page.goto(`/posts/${postsEnv.postId}`);
		await page.waitForLoadState("networkidle");
		await expect(page.locator(".comment-form textarea").first()).toBeVisible();

		await expect
			.poll(() => getBottomGap(page), { timeout: 5000 })
			.toBeLessThan(320);

		await page.waitForTimeout(1500);
		await expect(await getBottomGap(page)).toBeLessThan(320);
	});

	test("approved user can create sinmungo post without internal server error", async ({ page }) => {
		await login(page, postsEnv.userNickname, postsEnv.userPassword);

		const now = Date.now();
		const title = `신문고 E2E ${now}`;
		await page.goto("/sinmungo/new");
		await page.waitForLoadState("networkidle");
		await page.fill("#title", title);
		await page.fill("#serverAddress", "mc.example.com:25565");
		await page.fill("#content", `신문고 등록 E2E 내용 ${now}`);
		await page.getByRole("button", { name: "신문고 등록" }).click();

		await expect(page).toHaveURL(/\/posts\/\d+$/);
		await expect(page.getByText(title)).toBeVisible();
	});
});
