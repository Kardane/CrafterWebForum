import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditPostPage from "@/app/posts/[id]/edit/page";

const pushMock = vi.fn();
const showToastMock = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: pushMock,
	}),
}));

vi.mock("next/link", () => ({
	default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: {
			user: {
				id: "7",
			},
		},
		status: "authenticated",
	}),
}));

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({
		showToast: showToastMock,
	}),
}));

vi.mock("@/components/comments/MarkdownHelpModal", () => ({
	default: () => null,
}));

vi.mock("@/lib/client-video-upload", () => ({
	uploadImageFromBrowser: vi.fn(),
	uploadVideoFromBrowser: vi.fn(),
}));

vi.mock("@/lib/upload-response", () => ({
	parseUploadJsonResponse: vi.fn(),
}));

describe("EditPostPage", () => {
	beforeEach(() => {
		pushMock.mockReset();
		showToastMock.mockReset();
		vi.restoreAllMocks();
	});

	it("신문고 포스트를 수정할 때 서버 신문고 레이아웃과 서버 주소 필드를 보여줘야 함", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				post: {
					id: 15,
					title: "신문고 제목",
					content: "본문",
					tags: [],
					author_id: 7,
					board: "sinmungo",
					serverAddress: "mc.sinmungo.kr",
				},
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		render(<EditPostPage params={Promise.resolve({ id: "15" })} />);

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "서버 신문고 수정" })).toBeInTheDocument();
		});

		expect(screen.getByLabelText("서버 주소")).toHaveValue("mc.sinmungo.kr");
		expect(screen.queryByText("태그")).not.toBeInTheDocument();
	});

	it("신문고 수정 제출 시 board와 serverAddress를 유지해야 함", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					post: {
						id: 16,
						title: "신문고 제목",
						content: "본문",
						tags: [],
						author_id: 7,
						board: "sinmungo",
						serverAddress: "mc.sinmungo.kr",
					},
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});
		vi.stubGlobal("fetch", fetchMock);

		render(<EditPostPage params={Promise.resolve({ id: "16" })} />);

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "서버 신문고 수정" })).toBeInTheDocument();
		});

		fireEvent.change(screen.getByLabelText("서버 주소"), {
			target: { value: "mc.fixed.kr" },
		});
		fireEvent.click(screen.getByRole("button", { name: "수정 완료" }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		const submitRequest = fetchMock.mock.calls[1];
		expect(submitRequest[0]).toBe("/api/posts/16");
		expect(submitRequest[1]).toMatchObject({
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
		});
		expect(JSON.parse((submitRequest[1] as RequestInit).body as string)).toEqual({
			title: "신문고 제목",
			content: "본문",
			board: "sinmungo",
			serverAddress: "mc.fixed.kr",
			tags: [],
		});
	});
});
