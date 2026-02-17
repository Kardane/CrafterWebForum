import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CommentDateDividerRow from "@/components/comments/CommentDateDividerRow";

describe("CommentDateDividerRow", () => {
	it("날짜 라벨이 렌더링되어야 함", () => {
		render(<CommentDateDividerRow label="2026년 2월 12일 (목)" />);
		expect(screen.getByText("2026년 2월 12일 (목)")).toBeInTheDocument();
	});

	it("date-divider 클래스를 포함해야 함", () => {
		render(<CommentDateDividerRow label="테스트" />);
		expect(screen.getByText("테스트").parentElement).toHaveClass("date-divider");
	});

	it("좌우 구분선 요소를 렌더링해야 함", () => {
		const { container } = render(<CommentDateDividerRow label="테스트" />);
		expect(container.querySelectorAll(".divider-line")).toHaveLength(2);
	});
});
