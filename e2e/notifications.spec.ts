import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

const notificationEnv = {
	userA: {
		nickname: process.env.E2E_NOTIFICATION_USER_A_NICKNAME ?? "",
		password: process.env.E2E_NOTIFICATION_USER_A_PASSWORD ?? "",
	},
	userB: {
		nickname: process.env.E2E_NOTIFICATION_USER_B_NICKNAME ?? "",
		password: process.env.E2E_NOTIFICATION_USER_B_PASSWORD ?? "",
	},
	postId: process.env.E2E_NOTIFICATION_POST_ID ?? "",
	cronSecret: process.env.CRON_SECRET ?? "",
};

const hasNotificationE2EEnv =
	Boolean(notificationEnv.userA.nickname) &&
	Boolean(notificationEnv.userA.password) &&
	Boolean(notificationEnv.userB.nickname) &&
	Boolean(notificationEnv.userB.password) &&
	Boolean(notificationEnv.postId) &&
	Boolean(notificationEnv.cronSecret);

let prismaInstance: PrismaClient | null = null;

async function installPushMocks(context: BrowserContext) {
	await context.addInitScript(() => {
		let subscription: {
			endpoint: string;
			expirationTime: null;
			keys: { p256dh: string; auth: string };
			toJSON: () => {
				endpoint: string;
				expirationTime: null;
				keys: { p256dh: string; auth: string };
			};
			unsubscribe: () => Promise<boolean>;
		} | null = null;

		class MockNotification {
			static permission: NotificationPermission = "granted";

			static requestPermission() {
				return Promise.resolve("granted" as NotificationPermission);
			}

			onclick: (() => void) | null = null;

			constructor(_title: string, _options?: NotificationOptions) {}

			close() {}
		}

		const pushManager = {
			getSubscription: async () => subscription,
			subscribe: async () => {
				subscription = {
					endpoint: `https://example.com/push/${Date.now()}`,
					expirationTime: null,
					keys: {
						p256dh: "test-p256dh",
						auth: "test-auth",
					},
					toJSON() {
						return {
							endpoint: this.endpoint,
							expirationTime: this.expirationTime,
							keys: this.keys,
						};
					},
					unsubscribe: async () => {
						subscription = null;
						return true;
					},
				};
				return subscription;
			},
		};

		Object.defineProperty(window, "Notification", {
			configurable: true,
			writable: true,
			value: MockNotification,
		});
		Object.defineProperty(window, "PushManager", {
			configurable: true,
			writable: true,
			value: class PushManager {},
		});
		Object.defineProperty(window.navigator, "serviceWorker", {
			configurable: true,
			value: {
				register: async () => ({
					pushManager,
				}),
			},
		});
	});
}

async function login(page: Page, nickname: string, password: string) {
	await page.goto("/login");
	await page.waitForLoadState("networkidle");
	await expect(page.locator("#nickname")).toBeVisible();
	await expect(page.locator("#password")).toBeVisible();
	await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
	await page.waitForTimeout(250);
	await page.fill("#nickname", nickname);
	await page.fill("#password", password);
	await page.getByRole("button", { name: "로그인" }).click();
	await expect(page).toHaveURL(/\/$/);
}

async function openPost(page: Page) {
	await page.goto(`/posts/${notificationEnv.postId}`);
	await expect(page.locator(".comment-form textarea").first()).toBeVisible();
}

async function submitComment(page: Page, content: string) {
	await page.locator(".comment-form textarea").first().fill(content);
	await page.locator(".comment-form .submit-btn").first().click();
	await expect(page.getByText(content).first()).toBeVisible();
}

async function getPrisma(): Promise<PrismaClient> {
	loadEnvConfig(process.cwd());
	if (!prismaInstance) {
		prismaInstance = new PrismaClient();
	}
	return prismaInstance;
}

async function getUserIdByNickname(nickname: string): Promise<number> {
	const prisma = await getPrisma();
	const user = await prisma.user.findFirst({
		where: { nickname },
		select: { id: true },
	});
	expect(user).not.toBeNull();
	return user!.id;
}

test.describe("notifications", () => {
	test.skip(!hasNotificationE2EEnv, "알림 E2E 실행용 계정/포스트/크론 환경변수 필요");

	test("mention notification flow is visible and can be marked as read", async ({ browser }) => {
		const actorContext = await browser.newContext();
		const targetContext = await browser.newContext();
		const actorPage = await actorContext.newPage();
		const targetPage = await targetContext.newPage();

		try {
			await login(actorPage, notificationEnv.userA.nickname, notificationEnv.userA.password);
			await login(targetPage, notificationEnv.userB.nickname, notificationEnv.userB.password);
			const actorUserId = await getUserIdByNickname(notificationEnv.userA.nickname);
			const targetUserId = await getUserIdByNickname(notificationEnv.userB.nickname);
			const prisma = await getPrisma();
			const startedAt = new Date();

			await openPost(actorPage);
			await submitComment(
				actorPage,
				`@${notificationEnv.userB.nickname} mention-e2e-${Date.now()}`
			);

			await expect
				.poll(async () => {
					const notification = await prisma.notification.findFirst({
						where: {
							userId: targetUserId,
							actorId: actorUserId,
							type: "mention_comment",
							postId: Number(notificationEnv.postId),
							createdAt: { gte: startedAt },
						},
						orderBy: { id: "desc" },
						select: { id: true },
					});
					return notification?.id ?? null;
				})
				.not.toBeNull();

			await targetPage.goto("/notifications");
			await expect(
				targetPage.getByText(`${notificationEnv.userA.nickname}님이 회원님을 멘션했음`).first()
			).toBeVisible();
			await targetPage.getByRole("button", { name: "읽음 처리" }).first().click();
			await expect(targetPage.getByText("읽음").first()).toBeVisible();
		} finally {
			await actorContext.close();
			await targetContext.close();
		}
	});

	test("post subscription comment flow creates notification and push dispatch responds", async ({
		browser,
		request,
		baseURL,
	}) => {
		const actorContext = await browser.newContext();
		const subscriberContext = await browser.newContext();
		const subscriberOrigin = new URL(baseURL ?? "http://127.0.0.1:3000").origin;
		await installPushMocks(subscriberContext);
		await subscriberContext.grantPermissions(["notifications"], { origin: subscriberOrigin });

		const actorPage = await actorContext.newPage();
		const subscriberPage = await subscriberContext.newPage();

		try {
			await login(actorPage, notificationEnv.userA.nickname, notificationEnv.userA.password);
			await login(subscriberPage, notificationEnv.userB.nickname, notificationEnv.userB.password);

			await subscriberPage.goto("/profile");
			const pushSwitch = subscriberPage.locator('button[role="switch"]').first();
			await expect(pushSwitch).toBeVisible();
			if ((await pushSwitch.getAttribute("aria-checked")) !== "true") {
				await pushSwitch.click();
				await expect(pushSwitch).toHaveAttribute("aria-checked", "true");
			}

			await openPost(subscriberPage);
			const subscribeButton = subscriberPage.getByTitle("포스트 알림 켜기");
			if (await subscribeButton.count()) {
				await subscribeButton.first().click();
				await expect(subscriberPage.getByTitle("포스트 알림 끄기").first()).toBeVisible();
			}

			const actorUserId = await getUserIdByNickname(notificationEnv.userA.nickname);
			const subscriberUserId = await getUserIdByNickname(notificationEnv.userB.nickname);
			const startedAt = new Date();
			const prisma = await getPrisma();

			await openPost(actorPage);
			await submitComment(actorPage, `subscription-e2e-${Date.now()}`);

			await expect
				.poll(async () => {
					const notification = await prisma.notification.findFirst({
						where: {
							userId: subscriberUserId,
							actorId: actorUserId,
							type: "post_comment",
							postId: Number(notificationEnv.postId),
							createdAt: { gte: startedAt },
						},
						orderBy: { id: "desc" },
						select: { id: true },
					});
					return notification?.id ?? null;
				})
				.not.toBeNull();

			const notification = await prisma.notification.findFirst({
				where: {
					userId: subscriberUserId,
					actorId: actorUserId,
					type: "post_comment",
					postId: Number(notificationEnv.postId),
					createdAt: { gte: startedAt },
				},
				orderBy: { id: "desc" },
				select: { id: true },
			});
			expect(notification).not.toBeNull();

			await expect
				.poll(async () => {
					const delivery = await prisma.notificationDelivery.findFirst({
						where: {
							notificationId: notification!.id,
							userId: subscriberUserId,
						},
						orderBy: { id: "desc" },
						select: {
							status: true,
							attemptCount: true,
						},
					});
					return delivery ? `${delivery.status}:${delivery.attemptCount}` : null;
				})
				.toBe("queued:0");

			await subscriberPage.goto("/notifications");
			await expect(
				subscriberPage.getByText(`${notificationEnv.userA.nickname}님이 구독 중인 글에 새 댓글 남김`).first()
			).toBeVisible();

			const dispatchResponse = await request.post("/api/jobs/push-dispatch", {
				headers: {
					authorization: `Bearer ${notificationEnv.cronSecret}`,
				},
			});
			expect(dispatchResponse.ok()).toBe(true);
			const dispatchBody = await dispatchResponse.json();
			expect(dispatchBody).toEqual(
				expect.objectContaining({
					ok: true,
				})
			);

			await expect
				.poll(async () => {
					const delivery = await prisma.notificationDelivery.findFirst({
						where: {
							notificationId: notification!.id,
							userId: subscriberUserId,
						},
						orderBy: { id: "desc" },
						select: {
							status: true,
							attemptCount: true,
						},
					});
					if (!delivery) {
						return "missing";
					}
					if (delivery.status === "processing") {
						return "processing";
					}
					return `${delivery.status}:${delivery.attemptCount}`;
				})
				.not.toBe("queued:0");

			const deliveryAfterDispatch = await prisma.notificationDelivery.findFirst({
				where: {
					notificationId: notification!.id,
					userId: subscriberUserId,
				},
				orderBy: { id: "desc" },
				select: {
					status: true,
					attemptCount: true,
				},
			});
			expect(deliveryAfterDispatch).not.toBeNull();
			expect(deliveryAfterDispatch!.status).not.toBe("processing");
			expect(
				deliveryAfterDispatch!.status === "sent" ||
					deliveryAfterDispatch!.status === "dead" ||
					(deliveryAfterDispatch!.status === "queued" && deliveryAfterDispatch!.attemptCount > 0)
			).toBe(true);
		} finally {
			await actorContext.close();
			await subscriberContext.close();
		}
	});
});
