import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAdminJsonMock = vi.fn();
const fetchAdminResponseMock = vi.fn();

vi.mock("lucide-react", () => ({
	MoreHorizontal: () => null,
	Check: () => null,
	X: () => null,
	Shield: () => null,
	Ban: () => null,
	Trash2: () => null,
}));

vi.mock("@/components/admin/utils/fetch-admin", () => ({
	fetchAdminJson: fetchAdminJsonMock,
	fetchAdminResponse: fetchAdminResponseMock,
}));

vi.mock("@/lib/realtime/useRealtimeBroadcast", () => ({
	useRealtimeBroadcast: () => undefined,
}));

vi.mock("@/components/ui/Modal", () => ({
	Modal: ({
		isOpen,
		title,
		children,
	}: {
		isOpen: boolean;
		title: string;
		children: React.ReactNode;
	}) => (isOpen ? <div data-testid={`modal:${title}`}>{children}</div> : null),
}));

const baseUsers = [
	{
		id: 1,
		email: "tester@crafter.local",
		nickname: "tester",
		role: "user",
		isApproved: 1,
		isBanned: 0,
		createdAt: "2026-03-20T00:00:00.000Z",
		lastAuthAt: null,
		deletedAt: null,
		signupNote: null,
		minecraftUuid: null,
	},
];

describe("AdminUsersTab", () => {
	beforeEach(() => {
		fetchAdminJsonMock.mockReset();
		fetchAdminResponseMock.mockReset();
		fetchAdminJsonMock.mockResolvedValue({ users: baseUsers });
	});

	it("유저 생성 버튼을 보여주고 생성 모달을 열 수 있어야 함", async () => {
		const { default: AdminUsersTab } = await import("@/components/admin/tabs/AdminUsersTab");

		render(<AdminUsersTab />);

		await waitFor(() => expect(fetchAdminJsonMock).toHaveBeenCalledWith("/api/admin/users"));
		fireEvent.click(screen.getByRole("button", { name: "유저 생성" }));

		expect(screen.getByTestId("modal:관리자 직접 유저 생성")).toBeInTheDocument();
		expect(screen.getByLabelText("닉네임")).toBeInTheDocument();
	});

	it("비밀번호 확인이 다르면 생성 요청을 보내지 않아야 함", async () => {
		const { default: AdminUsersTab } = await import("@/components/admin/tabs/AdminUsersTab");

		render(<AdminUsersTab />);
		await waitFor(() => expect(fetchAdminJsonMock).toHaveBeenCalled());
		fireEvent.click(screen.getByRole("button", { name: "유저 생성" }));

		fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "alice" } });
		fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password1!" } });
		fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "password2!" } });
		fireEvent.click(screen.getByRole("button", { name: "생성" }));

		expect(fetchAdminResponseMock).not.toHaveBeenCalled();
		expect(screen.getByText("비밀번호 확인이 일치하지 않음")).toBeInTheDocument();
	});

	it("생성 성공 시 관리자 유저 생성 API를 호출하고 목록을 다시 불러와야 함", async () => {
		const { default: AdminUsersTab } = await import("@/components/admin/tabs/AdminUsersTab");

		render(<AdminUsersTab />);
		await waitFor(() => expect(fetchAdminJsonMock).toHaveBeenCalledTimes(1));
		fireEvent.click(screen.getByRole("button", { name: "유저 생성" }));

		fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "alice" } });
		fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password1!" } });
		fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "password1!" } });
		fireEvent.change(screen.getByLabelText("가입 메모"), { target: { value: "관리자 생성" } });
		fireEvent.click(screen.getByRole("button", { name: "생성" }));

		await waitFor(() =>
			expect(fetchAdminResponseMock).toHaveBeenCalledWith("/api/admin/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					nickname: "alice",
					password: "password1!",
					signupNote: "관리자 생성",
				}),
			})
		);
		await waitFor(() => expect(fetchAdminJsonMock).toHaveBeenCalledTimes(2));
	});
});
