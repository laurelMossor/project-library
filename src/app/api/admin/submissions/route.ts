import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/utils/server/superadmin";
import { listOpenSubmissions } from "@/lib/utils/server/event-submission";
import { forbidden, serverError } from "@/lib/utils/errors";

// Reads the live staging queue; never cache.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/submissions
 * List open (non-terminal) Poster Catcher submissions. Superadmin-only.
 */
export async function GET() {
	const ctx = await requireSuperAdmin();
	if (!ctx) return forbidden();

	try {
		const submissions = await listOpenSubmissions();
		return NextResponse.json(submissions);
	} catch (error) {
		console.error("GET /api/admin/submissions error:", error);
		return serverError("Failed to list submissions");
	}
}
