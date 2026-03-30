import { expect, test, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const editEnv = {
	userNickname: process.env.E2E_EDIT_POST_USER_NICKNAME ?? "",
	userPassword: process.env.E2E_EDIT_POST_USER_PASSWORD ?? "",
	postId: process.env.E2E_EDIT_POST_ID ?? "",
};

const hasEditE2EEnv =
	Boolean(editEnv.userNickname) &&
	Boolean(editEnv.userPassword) &&
	Boolean(editEnv.postId);

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

test.describe("post edit", () => {
	test.skip(!hasEditE2EEnv, "신문고 수정 E2E 실행용 계정/포스트 환경변수 필요");

	test("owner can edit a sinmungo post without internal server error", async ({ page }) => {
		await login(page, editEnv.userNickname, editEnv.userPassword);

		await page.goto(`/posts/${editEnv.postId}/edit`);
		await page.waitForLoadState("networkidle");
		await expect(page.getByRole("heading", { name: "서버 신문고 수정" })).toBeVisible();

		const nextAddress = `mc-fixed-${Date.now()}.kr`;
		await page.fill("#serverAddress", nextAddress);
		await page.getByRole("button", { name: "수정 완료" }).click();

		await expect(page).toHaveURL(new RegExp(`/posts/${editEnv.postId}$`));
		await expect(page.getByText(nextAddress)).toBeVisible();
	});
});
