import { afterEach, describe, expect, it, vi } from "vitest";

const originalAdminNicknames = process.env.ADMIN_NICKNAMES;

afterEach(() => {
	vi.resetModules();

	if (typeof originalAdminNicknames === "undefined") {
		delete process.env.ADMIN_NICKNAMES;
		return;
	}

	process.env.ADMIN_NICKNAMES = originalAdminNicknames;
});

describe("admin policy", () => {
	it("treats Karned as admin by default", async () => {
		delete process.env.ADMIN_NICKNAMES;
		vi.resetModules();

		const { isPrivilegedNickname } = await import("@/config/admin-policy");

		expect(isPrivilegedNickname("Karned")).toBe(true);
		expect(isPrivilegedNickname("karned")).toBe(true);
		expect(isPrivilegedNickname("another-user")).toBe(false);
	});

	it("merges ADMIN_NICKNAMES with defaults", async () => {
		process.env.ADMIN_NICKNAMES = "Alice, Bob";
		vi.resetModules();

		const { isPrivilegedNickname } = await import("@/config/admin-policy");

		expect(isPrivilegedNickname("alice")).toBe(true);
		expect(isPrivilegedNickname("BOB")).toBe(true);
		expect(isPrivilegedNickname("Karned")).toBe(true);
	});
});
