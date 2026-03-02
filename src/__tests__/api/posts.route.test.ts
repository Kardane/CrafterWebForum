import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postCreateMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			create: postCreateMock,
		},
	},
}));

describe("POST /api/posts", () => {
	beforeEach(() => {
		authMock.mockReset();
		postCreateMock.mockReset();
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "hello", content: "world" }),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(401);
	});

	it("returns 400 when required fields are missing", async () => {
		authMock.mockResolvedValue({ user: { id: 7 } });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "x" }),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(400);
	});

	it("uses session user id instead of client authorId", async () => {
		authMock.mockResolvedValue({ user: { id: "5" } });
		postCreateMock.mockResolvedValue({ id: 123 });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "secure title",
				content: "secure content",
				tags: ["news"],
				authorId: 999999,
			}),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(200);
		expect(postCreateMock).toHaveBeenCalledTimes(1);
		expect(postCreateMock).toHaveBeenCalledWith({
			data: {
				title: "secure title",
				content: "secure content",
				tags: "[\"news\"]",
				commentCount: 0,
				authorId: 5,
			},
		});
	});

	it("returns 400 when ombudsman server address is invalid", async () => {
		authMock.mockResolvedValue({ user: { id: "5" } });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "ombudsman",
				content: "content",
				board: "ombudsman",
				serverAddress: "bad address",
			}),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(400);
		expect(postCreateMock).not.toHaveBeenCalled();
	});

	it("stores ombudsman metadata tags when server address is valid", async () => {
		authMock.mockResolvedValue({ user: { id: "5" } });
		postCreateMock.mockResolvedValue({ id: 456 });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "ombudsman",
				content: "content",
				board: "ombudsman",
				serverAddress: "mc.example.com:25565",
				tags: ["general"],
			}),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(200);
		expect(postCreateMock).toHaveBeenCalledWith({
			data: expect.objectContaining({
				tags: "[\"__sys:board:ombudsman\",\"__sys:server:mc.example.com:25565\"]",
				authorId: 5,
			}),
		});
	});
});
