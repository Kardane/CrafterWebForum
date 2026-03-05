export const REALTIME_TOPICS = {
	post: (postId: number) => `post:${postId}`,
	user: (userId: number) => `user:${userId}`,
	adminUsers: () => "admin:users",
} as const;

export const REALTIME_EVENTS = {
	COMMENT_CREATED: "comment.created",
	COMMENT_UPDATED: "comment.updated",
	COMMENT_DELETED: "comment.deleted",
	COMMENT_PINNED_CHANGED: "comment.pinned_changed",
	POST_LIKE_TOGGLED: "post.like.toggled",
	POST_READ_MARKER_UPDATED: "post.readMarker.updated",
	ADMIN_USER_APPROVAL_UPDATED: "admin.user.approval.updated",
	COMMENT_TYPING_CHANGED: "comment.typing.changed",
	NOTIFICATION_CREATED: "notification.created",
	NOTIFICATION_READ_CHANGED: "notification.read.changed",
} as const;
