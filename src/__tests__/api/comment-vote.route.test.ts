import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializePollData, type PollData } from "@/lib/poll";

const authMock = vi.fn();
const commentFindUniqueMock = vi.fn();
const commentUpdateMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		comment: {
			findUnique: commentFindUniqueMock,
			update: commentUpdateMock,
		},
	},
}));

vi.mock("@/lib/realtime/server-broadcast", () => ({
	broadcastRealtime: vi.fn(),
}));

function buildPollContent(overrides?: Partial<PollData>) {
	const pollData: PollData = {
		question: "질문",
		options: [
			{ id: 0, text: "A", votes: 0 },
			{ id: 1, text: "B", votes: 0 },
		],
		settings: {
			duration_hours: 24,
			allow_multi: false,
			created_at: "2099-03-15T00:00:00.000Z",
		},
		voters: {},
		...overrides,
	};
	return `본문\n${serializePollData(pollData)}`;
}

describe("POST /api/comments/[id]/vote", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		commentFindUniqueMock.mockReset();
		commentUpdateMock.mockReset();
	});

	it("비로그인 사용자는 401을 반환해야 함", async () => {
		authMock.mockResolvedValue(null);
		const { POST } = await import("@/app/api/comments/[id]/vote/route");
		const req = new Request("http://localhost/api/comments/1/vote", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ optionId: 0 }),
		});
		const res = await POST(req as never, { params: Promise.resolve({ id: "1" }) });
		expect(res.status).toBe(401);
	});

	it("투표가 없는 댓글이면 400을 반환해야 함", async () => {
		authMock.mockResolvedValue({ user: { id: "7", role: "user" } });
		commentFindUniqueMock.mockResolvedValue({ id: 1, postId: 3, content: "plain comment" });
		const { POST } = await import("@/app/api/comments/[id]/vote/route");
		const req = new Request("http://localhost/api/comments/1/vote", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ optionId: 0 }),
		});
		const res = await POST(req as never, { params: Promise.resolve({ id: "1" }) });
		expect(res.status).toBe(400);
	});

	it("정상 투표 시 댓글 content 안의 poll JSON을 갱신해야 함", async () => {
		authMock.mockResolvedValue({ user: { id: "7", role: "user" } });
		commentFindUniqueMock.mockResolvedValue({ id: 1, postId: 3, content: buildPollContent() });
		commentUpdateMock.mockResolvedValue({
			id: 1,
			content: buildPollContent({
				options: [
					{ id: 0, text: "A", votes: 1 },
					{ id: 1, text: "B", votes: 0 },
				],
				voters: { "7": [0] },
			}),
			updatedAt: new Date("2026-03-15T01:00:00.000Z"),
		});

		const { POST } = await import("@/app/api/comments/[id]/vote/route");
		const req = new Request("http://localhost/api/comments/1/vote", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ optionId: 0 }),
		});
		const res = await POST(req as never, { params: Promise.resolve({ id: "1" }) });
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(commentUpdateMock).toHaveBeenCalledTimes(1);
		expect(body.comment.content).toContain("[POLL_JSON]");
		expect(body.comment.content).toContain("\"votes\":1");
	});
});
