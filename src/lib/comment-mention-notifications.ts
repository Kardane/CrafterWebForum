import { prisma } from "@/lib/prisma";
import { extractMentionNicknames } from "@/lib/mentions";
import { buildDeliveryDedupeKey } from "@/lib/push";

export type MentionTarget = {
	id: number;
	nickname: string;
};

export async function queueMentionNotificationsAndDeliveries(params: {
	content: string;
	actorUserId: number;
	actorNickname: string;
	postId: number;
	commentId: number;
}): Promise<MentionTarget[]> {
	const mentionNicknames = extractMentionNicknames(params.content);
	if (mentionNicknames.length === 0) {
		return [];
	}

	const mentionTargets = await prisma.user.findMany({
		where: {
			nickname: { in: mentionNicknames },
			deletedAt: null,
		},
		select: {
			id: true,
			nickname: true,
		},
	});

	const targets = mentionTargets.filter((target) => target.id !== params.actorUserId);
	if (targets.length === 0) {
		return [];
	}

	await prisma.notification.createMany({
		data: targets.map((target) => ({
			userId: target.id,
			actorId: params.actorUserId,
			type: "mention_comment",
			message: `${params.actorNickname}님이 회원님을 멘션했음`,
			postId: params.postId,
			commentId: params.commentId,
		})),
	});

	const createdNotifications = await prisma.notification.findMany({
		where: {
			userId: { in: targets.map((target) => target.id) },
			actorId: params.actorUserId,
			type: "mention_comment",
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

	const subscriptions = await prisma.pushSubscription.findMany({
		where: {
			userId: { in: createdNotifications.map((item) => item.userId) },
			isActive: 1,
		},
		select: {
			id: true,
			userId: true,
		},
	});
	if (subscriptions.length === 0) {
		return targets;
	}

	const notificationMap = new Map<number, number>();
	for (const created of createdNotifications) {
		notificationMap.set(created.userId, created.id);
	}

	const queuedAt = new Date();
	const deliveries = subscriptions.flatMap((subscription) => {
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
