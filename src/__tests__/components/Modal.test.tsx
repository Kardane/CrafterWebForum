import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Modal } from "@/components/ui/Modal";

describe("Modal", () => {
	afterEach(() => {
		document.body.style.overflow = "";
		document.body.style.position = "";
		document.body.style.top = "";
		document.body.style.left = "";
		document.body.style.right = "";
		document.body.style.width = "";
		vi.restoreAllMocks();
	});

	it("open 상태에서는 body scroll lock을 고정하고 close 시 원래 스크롤을 복원해야 함", () => {
		Object.defineProperty(window, "scrollY", { value: 320, configurable: true });
		const scrollToMock = vi.fn();
		vi.spyOn(window, "scrollTo").mockImplementation(scrollToMock as typeof window.scrollTo);

		const { unmount } = render(
			<Modal isOpen onClose={() => undefined} title="테스트 모달">
				내용
			</Modal>
		);

		expect(document.body.style.overflow).toBe("hidden");
		expect(document.body.style.position).toBe("fixed");
		expect(document.body.style.top).toBe("-320px");

		unmount();

		expect(document.body.style.overflow).toBe("");
		expect(document.body.style.position).toBe("");
		expect(scrollToMock).toHaveBeenCalledWith({ top: 320, behavior: "auto" });
	});
});
