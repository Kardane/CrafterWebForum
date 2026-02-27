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
	it("never treats nickname as privileged", async () => {
		delete process.env.ADMIN_NICKNAMES;
		vi.resetModules();

		const { isPrivilegedNickname } = await import("@/config/admin-policy");

		expect(isPrivilegedNickname("Karned")).toBe(false);
		expect(isPrivilegedNickname("karned")).toBe(false);
		expect(isPrivilegedNickname("another-user")).toBe(false);
	});

	it("ignores ADMIN_NICKNAMES overrides", async () => {
		process.env.ADMIN_NICKNAMES = "Alice, Bob";
		vi.resetModules();

		const { isPrivilegedNickname } = await import("@/config/admin-policy");

		expect(isPrivilegedNickname("alice")).toBe(false);
		expect(isPrivilegedNickname("BOB")).toBe(false);
		expect(isPrivilegedNickname("Karned")).toBe(false);
	});
});
