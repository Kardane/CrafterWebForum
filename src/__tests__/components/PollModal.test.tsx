import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PollModal from "@/components/poll/PollModal";

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({
		showToast: vi.fn(),
	}),
}));

describe("PollModal", () => {
	it("응답 입력칸에 여러 글자를 연속으로 입력할 수 있어야 함", () => {
		render(<PollModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);

		const optionInputs = screen.getAllByPlaceholderText("응답 입력");
		fireEvent.change(optionInputs[0], { target: { value: "테스트 응답" } });

		expect(screen.getAllByPlaceholderText("응답 입력")[0]).toHaveValue("테스트 응답");
	});
});
