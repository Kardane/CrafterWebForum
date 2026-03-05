import { prisma } from "@/lib/prisma";
import { buildDeliveryDedupeKey } from "@/lib/push";

export interface PostSubscriptionNotificationTarget {
	id: number;
	nickname: string;
}

export async function queuePostSubscriptionNotificationsAndDeliveries(params: {
	postId: number;
	commentId: number;
	actorUserId: number;
	actorNickname: string;
}): Promise<PostSubscriptionNotificationTarget[]> {
	const subscriptions = await prisma.postSubscription.findMany({
		where: {
			postId: params.postId,
			userId: {
				not: params.actorUserId,
			},
			user: {
				deletedAt: null,
				isBanned: 0,
				isApproved: 1,
			},
		},
		select: {
			userId: true,
			user: {
				select: {
					nickname: true,
				},
			},
		},
	});

	if (subscriptions.length === 0) {
		return [];
	}

	const targetMap = new Map<number, PostSubscriptionNotificationTarget>();
	for (const item of subscriptions) {
		targetMap.set(item.userId, {
			id: item.userId,
			nickname: item.user.nickname,
		});
	}
	const targets = Array.from(targetMap.values());
	if (targets.length === 0) {
		return [];
	}

	await prisma.notification.createMany({
		data: targets.map((target) => ({
			userId: target.id,
			actorId: params.actorUserId,
			type: "post_comment",
			message: `${params.actorNickname}님이 구독 중인 글에 새 댓글 남김`,
			postId: params.postId,
			commentId: params.commentId,
		})),
	});

	const createdNotifications = await prisma.notification.findMany({
		where: {
			userId: { in: targets.map((target) => target.id) },
			actorId: params.actorUserId,
			type: "post_comment",
			postId: params.postId,
			commentId: params.commentId,
		},
		select: {
			id: true,
			userId: true,
		},
	});
	if (createdNotifications.length === 0) {
		return targets;
	}

	const subscriptionsForPush = await prisma.pushSubscription.findMany({
		where: {
			userId: { in: createdNotifications.map((item) => item.userId) },
			isActive: 1,
		},
		select: {
			id: true,
			userId: true,
		},
	});
	if (subscriptionsForPush.length === 0) {
		return targets;
	}

	const notificationMap = new Map<number, number>();
	for (const created of createdNotifications) {
		notificationMap.set(created.userId, created.id);
	}

	const queuedAt = new Date();
	const deliveries = subscriptionsForPush.flatMap((subscription) => {
		const notificationId = notificationMap.get(subscription.userId);
		if (!notificationId) {
			return [];
		}
		return [
			{
				notificationId,
				userId: subscription.userId,
				subscriptionId: subscription.id,
				channel: "web_push",
				status: "queued",
				nextAttemptAt: queuedAt,
				dedupeKey: buildDeliveryDedupeKey(notificationId, "web_push", subscription.id),
			},
		];
	});

	if (deliveries.length > 0) {
		await prisma.notificationDelivery.createMany({
			data: deliveries,
		});
	}

	return targets;
}
