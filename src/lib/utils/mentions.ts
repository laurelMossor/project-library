// Isomorphic (no prisma): finds @handle mentions in comment text. The server uses it to decide who to
// notify; CommentRow uses it to bold the handles that resolved. Both read the same tokens, so what's
// bold is exactly who was tagged. The handle alphabet itself is owned by validations.ts.

import { HANDLE_CHARS, validateHandle } from "@/lib/validations";

/** One comment can notify at most this many identities in total, across its create and later edits. */
export const MAX_MENTION_NOTIFICATIONS = 10;

/**
 * What may sit right before a mention's `@`: the start of the text, or any character that couldn't be
 * part of a handle, an email (`bob@x.com`), or a URL path (`medium.com/@sam`, `mailto:`). A capture
 * group, not a lookbehind — lookbehind is a parse error on Safari before 16.4. Use with the `i` flag.
 * The extra characters go first so HANDLE_CHARS' trailing `-` stays a literal, not a range.
 */
export const MENTION_BOUNDARY = `(^|[^@/:${HANDLE_CHARS}])`;

// Group 1 = the boundary character (or ""), group 2 = the run of handle characters after `@`.
const MENTION_PATTERN = new RegExp(`${MENTION_BOUNDARY}@([${HANDLE_CHARS}]+)`, "gi");

/** The handle a raw token names: trailing `.`/`-`/`_` dropped (`@sam.` → `sam`), lowercased. Null if not handle-shaped. */
function toHandle(token: string): { handle: string; length: number } | null {
	const trimmed = token.replace(/[._-]+$/, "");
	const handle = trimmed.toLowerCase();
	return validateHandle(handle) ? { handle, length: trimmed.length } : null;
}

/** Every handle mentioned in `text`, lowercased and de-duplicated, in order of first appearance. */
export function extractMentionHandles(text: string): string[] {
	const seen = new Set<string>();
	for (const match of text.matchAll(MENTION_PATTERN)) {
		const parsed = toHandle(match[2]);
		if (parsed) seen.add(parsed.handle);
	}
	return [...seen];
}

export type MentionSegment = { kind: "text"; text: string } | { kind: "mention"; text: string; handle: string };

/**
 * Split `text` into plain and mention segments for rendering. Only handles in `known` (the ones that
 * resolved to a real user or page) become mentions; anything else stays plain text.
 */
export function splitMentions(text: string, known: ReadonlySet<string>): MentionSegment[] {
	const segments: MentionSegment[] = [];
	let cursor = 0;
	const pushText = (end: number) => {
		if (end > cursor) segments.push({ kind: "text", text: text.slice(cursor, end) });
	};
	for (const match of text.matchAll(MENTION_PATTERN)) {
		const parsed = toHandle(match[2]);
		if (!parsed || !known.has(parsed.handle)) continue;
		const start = match.index! + match[1].length; // the `@`, past the boundary character
		const end = start + 1 + parsed.length; // `@` + the handle as typed, minus trailing punctuation
		pushText(start);
		segments.push({ kind: "mention", text: text.slice(start, end), handle: parsed.handle });
		cursor = end;
	}
	pushText(text.length);
	return segments;
}
