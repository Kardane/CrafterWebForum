import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import PostCard from "@/components/posts/PostCard";

vi.mock("next/link", () => ({
	default: ({ children, href, className, onClick }: { children: ReactNode; href: string; className?: string; onClick?: () => void }) => (
		<a href={href} className={className} onClick={onClick}>
			{children}
		</a>
	),
}));

vi.mock("next/image", () => ({
	default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock("@/components/posts/LikeButton", () => ({
	default: () => <button type="button" aria-label="좋아요">like</button>,
}));

vi.mock("@/components/posts/PostSubscriptionButton", () => ({
	default: () => <button type="button" aria-label="구독">subscribe</button>,
}));

describe("PostCard", () => {
	it("카드 링크 안에 액션 버튼을 중첩하지 않아야 함", () => {
		render(
			<PostCard
				id={1}
				title="테스트 포스트"
				preview="미리보기"
				authorName="작성자"
				createdAt="2026-03-10T10:00:00.000Z"
				updatedAt="2026-03-10T10:05:00.000Z"
				viewCount={10}
				likeCount={2}
				commentCount={3}
				board="develope"
				tags={["Fabric"]}
			/>,
		);

		const link = screen.getByRole("link", { name: /테스트 포스트/i });
		expect(link).not.toContainElement(screen.getByRole("button", { name: "좋아요" }));
		expect(link).not.toContainElement(screen.getByRole("button", { name: "구독" }));
	});

	it("신문고 주소 복사 버튼도 카드 링크 바깥에 렌더링해야 함", () => {
		render(
			<PostCard
				id={2}
				title="신문고 포스트"
				preview="주소 이슈"
				authorName="관리자"
				createdAt="2026-03-10T10:00:00.000Z"
				updatedAt="2026-03-10T10:05:00.000Z"
				viewCount={1}
				likeCount={0}
				commentCount={0}
				board="sinmungo"
				serverAddress="mc.example.com"
				tags={[]}
			/>,
		);

		const link = screen.getByRole("link", { name: /신문고 포스트/i });
		const copyButton = screen.getByRole("button", { name: "서버 주소 복사" });
		expect(link).not.toContainElement(copyButton);
	});
});
