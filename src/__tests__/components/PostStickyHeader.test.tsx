import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PostStickyHeader from "@/components/posts/PostStickyHeader";

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
			/>,
		);

		expect(screen.getByRole("button", { name: "댓글 끝으로 스크롤" })).toBeInTheDocument();
	});

	it("맨 아래 버튼 클릭 시 댓글 끝으로 스크롤해야 함", () => {
		const target = document.createElement("div");
		target.id = "comment-feed-end";
		const scrollSpy = vi.fn();
		target.scrollIntoView = scrollSpy;
		document.body.appendChild(target);

		render(
			<PostStickyHeader
				postId={1}
				title="테스트"
				authorName="작성자"
				createdAt={new Date().toISOString()}
				commentCount={4}
				initialLikes={0}
				initialLiked={false}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "댓글 끝으로 스크롤" }));

		expect(scrollSpy).toHaveBeenCalledTimes(1);
		expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "end" });
	});
});
