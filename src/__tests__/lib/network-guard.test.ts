import { describe, expect, it } from "vitest";
import { isBlockedHostname, isBlockedIpAddress } from "@/lib/network-guard";

describe("network guard", () => {
	it("blocks localhost style hostnames", () => {
		expect(isBlockedHostname("localhost")).toBe(true);
		expect(isBlockedHostname("api.local")).toBe(true);
		expect(isBlockedHostname("example.com")).toBe(false);
	});

	it("blocks private and loopback ip ranges", () => {
		expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
		expect(isBlockedIpAddress("10.1.2.3")).toBe(true);
		expect(isBlockedIpAddress("172.16.10.2")).toBe(true);
		expect(isBlockedIpAddress("192.168.0.1")).toBe(true);
		expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
		expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
	});

	it("blocks private ipv6 prefixes", () => {
		expect(isBlockedIpAddress("::1")).toBe(true);
		expect(isBlockedIpAddress("fc00::1")).toBe(true);
		expect(isBlockedIpAddress("fd12::1")).toBe(true);
		expect(isBlockedIpAddress("fe80::1")).toBe(true);
		expect(isBlockedIpAddress("2001:4860:4860::8888")).toBe(false);
	});
});
