#!/usr/bin/env tsx
/**
 * CI guard: every top-level route folder under src/app/ must be reserved in
 * src/lib/const/reserved-handles.ts.
 *
 * Why: PR 2 collapses user/page profiles into a single `/[handle]/...` route
 * tree. If someone adds a new top-level route folder (say, `src/app/dashboard/`)
 * without also adding "dashboard" to RESERVED_HANDLES, then either:
 *   a) Next.js file-system routing wins and any user with handle "dashboard"
 *      is silently shadowed (their profile never resolves), or
 *   b) Worse, signup briefly allows handle "dashboard" until the new route
 *      ships, then existing users hit (a).
 *
 * Both outcomes are bugs. This script makes them impossible to merge.
 *
 * Run as part of `npm run validate` (this repo has no GitHub Actions yet — see
 * PR 2 plan notes). When CI is added later, wire this in directly.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { RESERVED_HANDLES } from "@/lib/const/reserved-handles";

const APP_DIR = join(process.cwd(), "src/app");

function listTopLevelRouteSegments(): string[] {
	const entries = readdirSync(APP_DIR, { withFileTypes: true });
	return entries
		.filter((e) => e.isDirectory())
		// Next.js route groups are wrapped in parens, e.g. `(auth)`. They
		// don't appear in the URL, so they don't shadow `/[handle]`.
		.filter((e) => !e.name.startsWith("("))
		// Hidden/dotfiles aren't routable either.
		.filter((e) => !e.name.startsWith("."))
		.map((e) => e.name);
}

function main(): void {
	let segments: string[];
	try {
		statSync(APP_DIR);
		segments = listTopLevelRouteSegments();
	} catch (err) {
		console.error(`✗ Could not read ${APP_DIR}:`, err);
		process.exit(2);
	}

	const missing = segments.filter((seg) => !RESERVED_HANDLES.has(seg));

	if (missing.length === 0) {
		console.log(
			`✓ All ${segments.length} top-level route segments under src/app/ are reserved.`,
		);
		return;
	}

	console.error(
		`\n✗ ${missing.length} top-level route segment(s) under src/app/ are NOT in RESERVED_HANDLES:\n`,
	);
	for (const m of missing) {
		console.error(`  - ${m}    (src/app/${m}/)`);
	}
	console.error(
		`\nFix: add ${missing.length === 1 ? "this segment" : "these segments"} to ` +
			`RESERVED_HANDLES in src/lib/const/reserved-handles.ts. ` +
			`See the file's header comment for the rationale.\n`,
	);
	process.exit(1);
}

main();
