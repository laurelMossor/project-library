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
//   - alphanumeric, hyphens, underscores
//   - 3–30 characters
//
// `generateHandle` is forgiving (it normalizes user input).
// `validateHandle` is strict (rejects anything that isn't already valid).

/**
 * Normalize a free-text input into a candidate handle.
 *
 * Strips/replaces invalid characters, collapses runs of hyphens, trims
 * leading/trailing hyphen/underscore, and caps at 30 chars. The result
 * may still be invalid (e.g., empty or shorter than 3 chars after
 * stripping) — pair with `validateHandle` to confirm before persisting.
 */
export function generateHandle(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9_-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[-_]+|[-_]+$/g, "")
		.slice(0, 30);
}
