export interface SidebarTrackedPost {
	postId: number;
	title: string;
	href: string;
	board: "develope" | "sinmungo";
	serverAddress: string | null;
	lastActivityAt: string;
	author: {
		nickname: string;
		minecraftUuid: string | null;
	};
	sourceFlags: {
		authored: boolean;
		subscribed: boolean;
	};
	isSubscribed: boolean;
	commentCount: number;
	newCommentCount: number;
	latestCommentId: number | null;
}

export interface SidebarTrackedPostsPage {
	limit: number;
	nextCursor: string | null;
	hasMore: boolean;
}
