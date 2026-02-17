import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReadMarkerRow from "@/components/comments/ReadMarkerRow";

describe("ReadMarkerRow", () => {
	it("마커 텍스트가 올바르게 렌더링되어야 함", () => {
		render(<ReadMarkerRow />);
		expect(screen.getByText("여기부터 새 댓글")).toBeInTheDocument();
	});

	it("read-marker 클래스를 가진 div가 포함되어야 함", () => {
		render(<ReadMarkerRow />);
		expect(screen.getByText("여기부터 새 댓글").parentElement).toHaveClass("read-marker");
	});

	it("좌우 구분선 요소를 렌더링해야 함", () => {
		const { container } = render(<ReadMarkerRow />);
		expect(container.querySelectorAll(".divider-line")).toHaveLength(2);
	});
});
