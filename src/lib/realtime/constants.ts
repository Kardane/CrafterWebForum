export const REALTIME_TOPICS = {
	post: (postId: number) => `post:${postId}`,
	user: (userId: number) => `user:${userId}`,
	adminInquiries: () => "admin:inquiries",
	adminUsers: () => "admin:users",
	inquiry: (inquiryId: number) => `inquiry:${inquiryId}`,
} as const;

export const REALTIME_EVENTS = {
	COMMENT_CREATED: "comment.created",
	COMMENT_UPDATED: "comment.updated",
	COMMENT_DELETED: "comment.deleted",
	COMMENT_PINNED_CHANGED: "comment.pinned_changed",
	POST_LIKE_TOGGLED: "post.like.toggled",
	POST_READ_MARKER_UPDATED: "post.readMarker.updated",
	ADMIN_INQUIRY_PENDING_COUNT_UPDATED: "admin.inquiry.pendingCount.updated",
	ADMIN_USER_APPROVAL_UPDATED: "admin.user.approval.updated",
	INQUIRY_REPLY_CREATED: "inquiry.reply.created",
	INQUIRY_STATUS_UPDATED: "inquiry.status.updated",
	COMMENT_TYPING_CHANGED: "comment.typing.changed",
	NOTIFICATION_CREATED: "notification.created",
	NOTIFICATION_READ_CHANGED: "notification.read.changed",
} as const;
