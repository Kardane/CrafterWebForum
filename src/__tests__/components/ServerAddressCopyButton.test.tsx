import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const showToastMock = vi.fn();

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({
		showToast: showToastMock,
	}),
}));

describe("ServerAddressCopyButton", () => {
	it("copies the server address when clicked", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: { writeText },
		});

		const { default: ServerAddressCopyButton } = await import("@/components/posts/ServerAddressCopyButton");
		render(<ServerAddressCopyButton serverAddress="mc.legacy.kr" />);

		fireEvent.click(screen.getByRole("button", { name: /서버 주소 복사/i }));

		await waitFor(() => {
			expect(writeText).toHaveBeenCalledWith("mc.legacy.kr");
			expect(showToastMock).toHaveBeenCalledWith({ type: "success", message: "서버 주소 복사 완료" });
		});
	});
});
