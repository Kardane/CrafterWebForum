import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
	usePathname: () => usePathnameMock(),
}));

vi.mock("@/components/sidebar/SidebarSettingsModal", () => ({
	default: () => null,
}));

vi.mock("@/components/ui/Modal", () => ({
	Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/SafeImage", () => ({
	default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt || "tool-icon"} />,
}));

vi.mock("@/lib/sidebar-settings", () => ({
	DEFAULT_SETTINGS: {},
	getSidebarSettings: () => ({}),
}));

vi.mock("@/lib/sidebar-tool-links", () => ({
	buildSidebarToolLinks: () => [{ id: 1, title: "GitHub", url: "https://github.com", icon_url: "" }],
}));

describe("ToolsDock", () => {
	it("hides the mobile floating button on composer pages", async () => {
		usePathnameMock.mockReturnValue("/posts/new");
		const { default: ToolsDock } = await import("@/components/layout/ToolsDock");

		render(<ToolsDock isVisible />);

		expect(screen.queryByTitle("도구 모음")).not.toBeInTheDocument();
	});

	it("shows the mobile floating button on regular pages", async () => {
		usePathnameMock.mockReturnValue("/develope");
		const { default: ToolsDock } = await import("@/components/layout/ToolsDock");

		render(<ToolsDock isVisible />);

		expect(screen.getByTitle("도구 모음")).toBeInTheDocument();
	});

	it("접힌 데스크톱 상태에서는 실제 핸들 버튼만 보여야 함", async () => {
		usePathnameMock.mockReturnValue("/develope");
		const { default: ToolsDock } = await import("@/components/layout/ToolsDock");

		const { container } = render(<ToolsDock isVisible />);

		const handle = screen.getByTitle("도구 모음 열기");
		const aside = container.querySelector("aside") as HTMLElement | null;

		expect(handle.className).toContain("top-1/2");
		expect(aside?.className).toContain("pointer-events-none");
		expect(aside?.className).toContain("translate-x-full");
	});

	it("데스크톱 패널은 핸들로 열고 닫을 수 있어야 함", async () => {
		usePathnameMock.mockReturnValue("/develope");
		const { default: ToolsDock } = await import("@/components/layout/ToolsDock");

		const { container } = render(<ToolsDock isVisible />);
		const handle = screen.getByTitle("도구 모음 열기");
		const aside = container.querySelector("aside") as HTMLElement;

		fireEvent.click(handle);
		expect(aside.className).toContain("translate-x-0");
		expect(aside.className).toContain("opacity-100");

		fireEvent.click(screen.getByTitle("도구 모음 접기"));
		expect(aside.className).toContain("translate-x-full");
	});
});
