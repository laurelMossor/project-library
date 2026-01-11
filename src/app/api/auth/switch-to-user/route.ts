import { NextResponse } from "next/server";
import { auth, update } from "@/lib/auth";

/**
 * POST /api/auth/switch-to-user
 * Switch the user's active actor back to their user account (clear activeOrgId)
 */
export async function POST() {
	try {
		const session = await auth();
		
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Update session to clear activeOrgId
		await update({
			activeOrgId: null,
		});

		return NextResponse.json({ success: true, activeOrgId: null });
	} catch (error) {
		console.error("Error switching to user:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
