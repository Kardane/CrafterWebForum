import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PostStickyHeader from "@/components/posts/PostStickyHeader";
import { SCROLL_COMMENT_FEED_BOTTOM_EVENT } from "@/constants/comments";

vi.mock("next/link", () => ({
	default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
		<a href={href} className={className}>
			{children}
		</a>
	),
}));

vi.mock("@/components/posts/LikeButton", () => ({
	default: () => <button type="button">like</button>,
}));

describe("PostStickyHeader", () => {
	afterEach(() => {
		document.getElementById("comment-feed-end")?.remove();
	});

	it("맨 아래 버튼을 렌더링해야 함", () => {
		render(
			<PostStickyHeader
				postId={1}
				title="테스트"
				authorName="작성자"
				createdAt={new Date().toISOString()}
				commentCount={4}
				initialLikes={0}
				initialLiked={false}
				initialSubscribed={false}
			/>,
		);

		expect(screen.getByRole("button", { name: "댓글 끝으로 스크롤" })).toBeInTheDocument();
	});

	it("맨 아래 버튼 클릭 시 댓글 끝으로 스크롤해야 함", () => {
		const eventSpy = vi.fn();
		window.addEventListener(SCROLL_COMMENT_FEED_BOTTOM_EVENT, eventSpy);

		render(
			<PostStickyHeader
				postId={1}
				title="테스트"
				authorName="작성자"
				createdAt={new Date().toISOString()}
				commentCount={4}
				initialLikes={0}
				initialLiked={false}
				initialSubscribed={false}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "댓글 끝으로 스크롤" }));

		expect(eventSpy).toHaveBeenCalledTimes(1);
		window.removeEventListener(SCROLL_COMMENT_FEED_BOTTOM_EVENT, eventSpy);
	});

	it("backHref를 넘기면 해당 경로로 목록 버튼이 이동해야 함", () => {
		render(
			<PostStickyHeader
				postId={1}
				title="테스트"
				authorName="작성자"
				createdAt={new Date().toISOString()}
				commentCount={0}
				initialLikes={0}
				initialLiked={false}
				initialSubscribed={false}
				backHref="/"
			/>
		);

		expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/");
	});
});
