import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/ToastProvider";
import ServerAddressTag from "@/components/posts/ServerAddressTag";

describe("ServerAddressTag", () => {
	it("클릭하면 서버 주소를 클립보드에 복사해야 함", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});

		render(
			<ToastProvider>
				<ServerAddressTag address="mc.example.com:25565" />
			</ToastProvider>
		);

		fireEvent.click(screen.getByRole("button", { name: "서버 주소 복사: mc.example.com:25565" }));
		await waitFor(() => {
			expect(writeText).toHaveBeenCalledWith("mc.example.com:25565");
		});
	});
});
