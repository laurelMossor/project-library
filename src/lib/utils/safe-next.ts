/**
 * An in-app path to send someone after setup. Rejects protocol-relative and
 * backslash URLs, which some browsers treat as a different site. Query strings
 * stay, because setup returns people to the page they were already on.
 * Next.js decodes the query once before this runs.
 */
export function safeNext(next: string | undefined, fallback: string): string {
	if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
	if (next.includes("\\") || next.includes("://")) return fallback;
	if (/%(?:2f|5c)/i.test(next)) return fallback;
	if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
	return next;
}
