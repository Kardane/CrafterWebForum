import { render, screen, fireEvent } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { describe, it, expect, vi } from "vitest";
import UserAvatar from "@/components/ui/UserAvatar";

type MockNextImageProps = ImgHTMLAttributes<HTMLImageElement> & {
	src: string;
	alt: string;
};

// Mock next/image to behave like a standard img tag for testing onError
vi.mock("next/image", () => ({
	default: ({ src, alt, onError, unoptimized, ...props }: MockNextImageProps & { unoptimized?: boolean }) => {
		void unoptimized;
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={src} alt={alt} onError={onError} {...props} />;
	},
}));

describe("UserAvatar", () => {
	it("renders initials when uuid is not provided", () => {
		render(<UserAvatar nickname="Tester" />);
		expect(screen.getByText("T")).toBeInTheDocument();
	});

	it("renders primary image source initially", () => {
		render(<UserAvatar nickname="Tester" uuid="test-uuid" />);
		const img = screen.getByRole("img") as HTMLImageElement;
		expect(img.src).toContain("api.mineatar.io");
	});

	it("falls back to secondary source on error", () => {
		render(<UserAvatar nickname="Tester" uuid="test-uuid" />);
		const img = screen.getByRole("img") as HTMLImageElement;

		// Trigger error on primary
		fireEvent.error(img);

		expect(img.src).toContain("mc-heads.net");
	});

	it("falls back to initials on secondary error", () => {
		render(<UserAvatar nickname="Tester" uuid="test-uuid" />);
		const img = screen.getByRole("img") as HTMLImageElement;

		// Trigger error on primary
		fireEvent.error(img);
		// Trigger error on secondary
		fireEvent.error(img);

		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		expect(screen.getByText("T")).toBeInTheDocument();
	});
});
