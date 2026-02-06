import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/generated/client", () => ({
	PrismaClient: class PrismaClient {
		comment = {
			findUnique: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
		};
	},
}));

describe("PATCH /api/comments/[id]", () => {
	beforeEach(() => {
		authMock.mockReset();
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		const { PATCH } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/1", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		});
		const res = await PATCH(req as never, { params: Promise.resolve({ id: "1" }) });
		expect(res.status).toBe(401);
	});
});

