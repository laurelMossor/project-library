// ⚠️ SERVER-ONLY: SSRF-guarded outbound fetch
//
// Poster Catcher fetches URLs that originate from user input (a forwarded Telegram link) and,
// worse, from the *fetched page itself* (an og:image URL). A bare `fetch` there is a classic
// SSRF: an attacker can point the server at cloud metadata (169.254.169.254), loopback, or an
// internal service, and any image-typed response gets stored + shown in /admin/submissions.
//
// `safeFetch` validates the destination before every hop: HTTP(S) only, and the resolved
// address must be publicly routable (no loopback / private / link-local / ULA / multicast).
// Redirects are followed manually so each hop is re-validated (an allowed host can't 302 inward).

import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — posters are small; cap runaway bodies.

/** Is this IPv4 literal in a blocked (non-public) range? */
function isBlockedIpv4(ip: string): boolean {
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return true;
	const [a, b] = parts;
	if (a === 0) return true; // 0.0.0.0/8 "this network"
	if (a === 10) return true; // private
	if (a === 127) return true; // loopback
	if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
	if (a === 172 && b >= 16 && b <= 31) return true; // private
	if (a === 192 && b === 168) return true; // private
	if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
	if (a >= 224) return true; // 224/4 multicast + 240/4 reserved
	return false;
}

/** Is this IPv6 literal in a blocked (non-public) range? */
function isBlockedIpv6(ip: string): boolean {
	const s = ip.toLowerCase();
	if (s === "::1" || s === "::") return true; // loopback / unspecified
	const first = parseInt(s.split(":")[0] || "0", 16);
	if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
	if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
	if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
	return false;
}

/**
 * True if `ip` is a literal address we refuse to connect to (loopback, private, link-local,
 * ULA, multicast, metadata). Unparseable input is treated as blocked (fail-closed). Exported
 * for unit testing the range table without touching the network.
 */
export function isBlockedIp(ip: string): boolean {
	const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i); // IPv4-mapped IPv6
	if (mapped) return isBlockedIpv4(mapped[1]);
	if (net.isIPv4(ip)) return isBlockedIpv4(ip);
	if (net.isIPv6(ip)) return isBlockedIpv6(ip);
	return true;
}

/**
 * Validate that `rawUrl` is an HTTP(S) URL whose host resolves only to publicly routable
 * addresses. Throws otherwise. Returns the parsed URL. Note: this resolves-then-checks, so it
 * does not by itself close a DNS-rebinding TOCTOU — acceptable given the allowlisted-sender
 * trust boundary; a pinned-IP agent would be the fuller fix.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new Error(`Invalid URL: ${rawUrl}`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`Blocked non-HTTP(S) URL: ${url.protocol}`);
	}
	const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
	if (net.isIP(host)) {
		if (isBlockedIp(host)) throw new Error(`Blocked non-public address: ${host}`);
		return url;
	}
	const results = await lookup(host, { all: true });
	if (results.length === 0) throw new Error(`Could not resolve host: ${host}`);
	for (const r of results) {
		if (isBlockedIp(r.address)) throw new Error(`Host ${host} resolves to a blocked address: ${r.address}`);
	}
	return url;
}

/**
 * SSRF-guarded `fetch`. Validates the destination before each hop and follows redirects
 * manually (re-validating each `Location`) up to a small limit. Rejects oversized bodies via
 * Content-Length. Forwards the caller's `init` (headers, signal/timeout), overriding `redirect`.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
	let currentUrl = rawUrl;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		await assertPublicUrl(currentUrl);
		const res = await fetch(currentUrl, { ...init, redirect: "manual" });
		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get("location");
			if (!location) return res;
			currentUrl = new URL(location, currentUrl).toString();
			continue;
		}
		const len = res.headers.get("content-length");
		if (len && Number(len) > MAX_BYTES) {
			throw new Error(`Response too large: ${len} bytes`);
		}
		return res;
	}
	throw new Error(`Too many redirects for ${rawUrl}`);
}
