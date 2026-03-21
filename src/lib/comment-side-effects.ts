import { prisma } from "@/lib/prisma";
import { queueMentionNotificationsAndDeliveries } from "@/lib/comment-mention-notifications";
import { queuePostSubscriptionNotificationsAndDeliveries } from "@/lib/comment-subscription-notifications";
import { isMissingCommentSideEffectJobTableError } from "@/lib/db-schema-guard";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";

const COMMENT_SIDE_EFFECT_RETRY_DELAYS_MS = [15_000, 60_000, 5 * 60_000, 30 * 60_000] as const;

export type CommentSideEffectInput = {
	commentId: number;
	postId: number;
	actorUserId: number;
	actorNickname: string;
	content: string;
};

export function getCommentSideEffectRetryDelayMs(attemptCount: number) {
	return (
		COMMENT_SIDE_EFFECT_RETRY_DELAYS_MS[attemptCount - 1] ??
		COMMENT_SIDE_EFFECT_RETRY_DELAYS_MS[COMMENT_SIDE_EFFECT_RETRY_DELAYS_MS.length - 1]
	);
}

export async function enqueueCommentSideEffectJob(input: CommentSideEffectInput) {
	return prisma.commentSideEffectJob.create({
		data: {
			commentId: input.commentId,
			postId: input.postId,
			actorUserId: input.actorUserId,
			actorNickname: input.actorNickname,
			content: input.content,
			status: "queued",
			nextAttemptAt: new Date(),
		},
		select: {
			id: true,
			commentId: true,
		},
	});
}

export async function runCommentSideEffects(input: CommentSideEffectInput) {
	const loadTargetsStartedAt = Date.now();
	const mentionTargets = await queueMentionNotificationsAndDeliveries({
		content: input.content,
		actorUserId: input.actorUserId,
		actorNickname: input.actorNickname,
		postId: input.postId,
		commentId: input.commentId,
	});
	const createNotificationsMs = Date.now() - loadTargetsStartedAt;

	const broadcastStartedAt = Date.now();
	for (const target of mentionTargets) {
		void broadcastRealtime({
			topic: REALTIME_TOPICS.user(target.id),
			event: REALTIME_EVENTS.NOTIFICATION_CREATED,
			payload: {
				type: "mention_comment",
				postId: input.postId,
				commentId: input.commentId,
				actorNickname: input.actorNickname,
				targetNickname: target.nickname,
			},
		});
	}

	const subscriptionStartedAt = Date.now();
	const subscriptionTargets = await queuePostSubscriptionNotificationsAndDeliveries({
		postId: input.postId,
		commentId: input.commentId,
		actorUserId: input.actorUserId,
		actorNickname: input.actorNickname,
	});
	const queueDeliveriesMs = Date.now() - subscriptionStartedAt;

	for (const target of subscriptionTargets) {
		void broadcastRealtime({
			topic: REALTIME_TOPICS.user(target.id),
			event: REALTIME_EVENTS.NOTIFICATION_CREATED,
			payload: {
				type: "post_comment",
				postId: input.postId,
				commentId: input.commentId,
				actorNickname: input.actorNickname,
				targetNickname: target.nickname,
			},
		});
	}
	const broadcastMs = Date.now() - broadcastStartedAt;

	return {
		mentionTargets,
		subscriptionTargets,
		durations: {
			load_targets: createNotificationsMs,
			create_notifications: createNotificationsMs,
			queue_deliveries: queueDeliveriesMs,
			broadcast: broadcastMs,
		},
	};
}

export { isMissingCommentSideEffectJobTableError };
