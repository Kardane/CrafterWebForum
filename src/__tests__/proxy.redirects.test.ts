import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const authMock = vi.fn();

vi.mock("@/auth.config", () => ({
	auth: authMock,
}));

vi.mock("@/config/admin-policy", () => ({
	isPrivilegedNickname: () => false,
}));

function createRequest(url: string) {
	const nextUrl = new URL(url) as URL & { clone: () => URL };
	nextUrl.clone = () => new URL(nextUrl.toString());

	return {
		url,
		nextUrl,
	} as unknown as NextRequest;
}

describe("proxy redirects", () => {
	beforeEach(() => {
		authMock.mockReset();
		authMock.mockResolvedValue(null);
	});

	it("redirects /post to /", async () => {
		const { proxy } = await import("@/proxy");
		const response = await proxy(createRequest("http://localhost/post"));

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("http://localhost/");
	});

	it("redirects /post/[id] to /posts/[id]", async () => {
		const { proxy } = await import("@/proxy");
		const response = await proxy(createRequest("http://localhost/post/123"));

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("http://localhost/posts/123");
	});
});
