import { NextResponse } from "next/server";
import { auth, update } from "@/lib/auth";
import { canActAsOrg } from "@/lib/utils/server/actor-session";

/**
 * POST /api/auth/switch-org
 * Switch the user's active actor to an org
 * Body: { orgId: string }
 */
export async function POST(request: Request) {
	try {
		const session = await auth();
		
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const { orgId } = body;

		if (!orgId || typeof orgId !== "string") {
			return NextResponse.json(
				{ error: "orgId is required" },
				{ status: 400 }
			);
		}

		// Verify user has permission to act as this org
		const hasPermission = await canActAsOrg(session.user.id, orgId);
		if (!hasPermission) {
			return NextResponse.json(
				{ error: "You do not have permission to act as this organization" },
				{ status: 403 }
			);
		}

		// Update session with activeOrgId
		await update({
			activeOrgId: orgId,
		});

		return NextResponse.json({ success: true, activeOrgId: orgId });
	} catch (error) {
		console.error("Error switching to org:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
