import { expect, test, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const adminPostsEnv = {
	nickname: process.env.E2E_ADMIN_NICKNAME ?? "",
	password: process.env.E2E_ADMIN_PASSWORD ?? "",
	postId: process.env.E2E_ADMIN_POST_ID ?? "",
};

const hasAdminPostsEnv =
	Boolean(adminPostsEnv.nickname) &&
	Boolean(adminPostsEnv.password) &&
	Boolean(adminPostsEnv.postId);

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

test.describe("admin posts", () => {
	test.skip(!hasAdminPostsEnv, "관리자 포스트 E2E 실행용 관리자 계정/포스트 환경변수 필요");

	test("admin can archive and restore a sinmungo post without 500", async ({ page }) => {
		await login(page, adminPostsEnv.nickname, adminPostsEnv.password);
		page.on("dialog", (dialog) => dialog.accept());

		await page.goto("/admin?tab=posts");
		await page.waitForLoadState("networkidle");

		const activeRow = page.locator("tbody tr").filter({
			has: page.getByText(adminPostsEnv.postId, { exact: true }),
		});
		await expect(activeRow.first()).toBeVisible();
		await activeRow.first().getByRole("button", { name: "아카이브" }).click();

		await expect(page.getByText("포스트 아카이브에 실패했습니다")).toHaveCount(0);

		const archivedSection = page.locator("details").first();
		await archivedSection.locator("summary").click();
		const archivedRow = archivedSection.locator("tbody tr").filter({
			has: page.getByText(adminPostsEnv.postId, { exact: true }),
		});
		await expect(archivedRow.first()).toBeVisible();
		await archivedRow.first().getByRole("button", { name: "복구" }).click();

		await expect(page.getByText("포스트 복구에 실패했습니다")).toHaveCount(0);
		await expect(activeRow.first()).toBeVisible();
	});
});
