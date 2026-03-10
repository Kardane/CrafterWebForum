import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
});
