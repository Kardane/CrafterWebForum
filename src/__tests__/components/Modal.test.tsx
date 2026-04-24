import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

	it("dialog 접근성 속성과 제목 연결을 제공해야 함", () => {
		render(
			<Modal isOpen onClose={() => undefined} title="테스트 모달">
				내용
			</Modal>
		);

		const dialog = screen.getByRole("dialog", { name: "테스트 모달" });
		expect(dialog).toHaveAttribute("aria-modal", "true");
		expect(dialog).toHaveAttribute("aria-labelledby");
	});

	it("열릴 때 포커스를 모달 안으로 옮기고 닫힐 때 이전 포커스를 복원해야 함", async () => {
		const trigger = document.createElement("button");
		trigger.textContent = "열기";
		document.body.appendChild(trigger);
		trigger.focus();

		const { unmount } = render(
			<Modal isOpen onClose={() => undefined} title="포커스 모달">
				<button type="button">첫 버튼</button>
			</Modal>
		);

		await waitFor(() => expect(screen.getByRole("button", { name: "모달 닫기" })).toHaveFocus());
		unmount();
		expect(trigger).toHaveFocus();
		trigger.remove();
	});

	it("Tab 포커스가 모달 밖으로 빠지지 않아야 함", async () => {
		render(
			<Modal isOpen onClose={() => undefined} title="포커스 트랩">
				<button type="button">첫 버튼</button>
				<button type="button">마지막 버튼</button>
			</Modal>
		);

		const lastButton = screen.getByRole("button", { name: "마지막 버튼" });
		const closeButton = screen.getByRole("button", { name: "모달 닫기" });
		await waitFor(() => expect(closeButton).toHaveFocus());

		lastButton.focus();
		fireEvent.keyDown(window, { key: "Tab" });
		expect(closeButton).toHaveFocus();

		fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
		expect(lastButton).toHaveFocus();
	});
});
