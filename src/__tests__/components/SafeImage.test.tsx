import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SafeImage from "@/components/ui/SafeImage";

vi.mock("next/image", () => ({
	default: (props: Record<string, unknown>) => <img alt={String(props.alt ?? "")} data-props={JSON.stringify(props)} />,
}));

describe("SafeImage", () => {
	it("decoding 기본값은 async여야 함", () => {
		render(<SafeImage src="https://example.com/thumb.png" alt="thumb" width={96} height={96} />);

		const image = screen.getByRole("img", { name: "thumb" });
		const props = JSON.parse(image.getAttribute("data-props") ?? "{}") as Record<string, unknown>;
		expect(props.decoding).toBe("async");
	});

	it("호출자가 decoding을 넘기면 그대로 유지해야 함", () => {
		render(
			<SafeImage
				src="https://example.com/thumb.png"
				alt="thumb"
				width={96}
				height={96}
				decoding="sync"
			/>
		);

		const image = screen.getByRole("img", { name: "thumb" });
		const props = JSON.parse(image.getAttribute("data-props") ?? "{}") as Record<string, unknown>;
		expect(props.decoding).toBe("sync");
	});
});
