// Handle utilities (URL-safe identity slug for User and Page).
//
// A "handle" is the public, lowercase token that appears in URLs:
//   /laurel  → User (laurel.handle = "laurel")
//   /spats   → Page (spats.handle  = "spats")
//
// Replaces both the old `username` (User) and `slug` (Page) terminology.
// One vocabulary across the app, one validator, one generator.
//
// Rules (must match `validateHandle` in `lib/validations.ts`):
//   - lowercase
//   - letters, numbers, periods, underscores, hyphens
//   - 3–30 characters
//
// `generateHandle` is forgiving (it normalizes user input).
// `validateHandle` is strict (rejects anything that isn't already valid).

import { validateHandle } from "@/lib/validations";

/**
 * Normalize a free-text input into a candidate handle.
 *
 * Strips/replaces invalid characters, collapses runs of hyphens, trims
 * leading/trailing periods, hyphens, and underscores, and caps at 30 chars.
 * Periods stay, because a handle may contain them. The result may still be
 * invalid (empty, or shorter than 3 chars) — pair with `validateHandle`
 * before persisting.
 */
export function generateHandle(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9._-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[-_.]+|[-_.]+$/g, "")
		.slice(0, 30);
}

/**
 * What a handle field may show while someone is typing.
 *
 * Lowercases and drops anything outside the alphabet. A trailing `.`, `-`, or `_`
 * stays, so `foo-` can still become `foo-bar`. `Foo!!` is `foo`.
 */
export function sanitizeHandleTyping(input: string): string {
	return input.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
}

/** Suggest a handle from a display name. Forgiving. The handle field stores it only once `validateHandle` passes. */
export function handleFromName(name: string): string {
	return generateHandle(name);
}

/**
 * Suggest a page name from a handle. The name is the canonical handle, and only
 * once that handle is legal. Null leaves any previous valid suggestion in place.
 */
export function nameFromHandle(handle: string): string | null {
	const canonical = generateHandle(handle);
	return validateHandle(canonical) ? canonical : null;
}
