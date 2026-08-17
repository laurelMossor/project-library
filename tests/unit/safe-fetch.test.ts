/**
 * SSRF guard tests — the pure IP-range classifier plus the URL gate with DNS mocked.
 * No network access; `node:dns/promises` is stubbed so `assertPublicUrl` is deterministic.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("node:dns/promises", () => {
	const lookup = vi.fn();
	return { default: { lookup }, lookup };
});

import { lookup } from "node:dns/promises";
import { isBlockedIp, assertPublicUrl } from "@/lib/utils/server/safe-fetch";

describe("isBlockedIp (range table)", () => {
	test("blocks loopback, private, link-local/metadata, and CGNAT IPv4", () => {
		for (const ip of [
			"127.0.0.1",
			"10.0.0.5",
			"172.16.0.1",
			"172.31.255.255",
			"192.168.1.1",
			"169.254.169.254", // cloud metadata
			"0.0.0.0",
			"100.64.0.1",
			"224.0.0.1", // multicast
		]) {
			expect(isBlockedIp(ip), ip).toBe(true);
		}
	});

	test("allows ordinary public IPv4", () => {
		for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1"]) {
			expect(isBlockedIp(ip), ip).toBe(false);
		}
	});

	test("blocks loopback / ULA / link-local IPv6 and IPv4-mapped private", () => {
		for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
			expect(isBlockedIp(ip), ip).toBe(true);
		}
	});

	test("allows public IPv6 and blocks garbage (fail-closed)", () => {
		expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
		expect(isBlockedIp("not-an-ip")).toBe(true);
	});
});

describe("assertPublicUrl", () => {
	beforeEach(() => vi.clearAllMocks());

	test("rejects non-HTTP(S) schemes without resolving", async () => {
		await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/non-HTTP/i);
		await expect(assertPublicUrl("ftp://example.com/x")).rejects.toThrow(/non-HTTP/i);
		expect(vi.mocked(lookup)).not.toHaveBeenCalled();
	});

	test("rejects a literal private IP host without a DNS lookup", async () => {
		await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/non-public/i);
		await expect(assertPublicUrl("http://127.0.0.1:6379")).rejects.toThrow(/non-public/i);
		expect(vi.mocked(lookup)).not.toHaveBeenCalled();
	});

	test("rejects a hostname that resolves to a private address", async () => {
		vi.mocked(lookup).mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as unknown as never);
		await expect(assertPublicUrl("http://internal.evil.test/")).rejects.toThrow(/blocked address/i);
	});

	test("rejects when ANY resolved address is private (multi-record)", async () => {
		vi.mocked(lookup).mockResolvedValue([
			{ address: "93.184.216.34", family: 4 },
			{ address: "127.0.0.1", family: 4 },
		] as unknown as never);
		await expect(assertPublicUrl("http://mixed.test/")).rejects.toThrow(/blocked address/i);
	});

	test("accepts a hostname that resolves to a public address", async () => {
		vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as unknown as never);
		const url = await assertPublicUrl("https://example.com/poster.jpg");
		expect(url.hostname).toBe("example.com");
	});
});
