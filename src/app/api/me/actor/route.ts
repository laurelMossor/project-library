import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canActAsOrg } from "@/lib/utils/server/actor-session";
import { getActiveActor } from "@/lib/utils/server/actor-session";

/**
 * GET /api/me/actor
 * Get the current active actor (user or org based on activeOrgId in session)
 */
export async function GET() {
	try {
		const session = await auth();
		
		if (!session?.user?.id) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		const actor = await getActiveActor(session);
		
		if (!actor) {
			return NextResponse.json(
				{ error: "Actor not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			type: actor.type,
			data: actor.data,
			activeOrgId: session.user.activeOrgId || null,
		});
	} catch (error) {
		console.error("Error getting active actor:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

/**
 * PUT /api/me/actor
 * Switch the user's active actor
 * Body: { orgId: string | null }
 * - If orgId is provided: switch to that org (must have permission)
 * - If orgId is null: switch back to user account
 */
export async function PUT(request: Request) {
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

		// If orgId is null or undefined, switch to user
		if (orgId === null || orgId === undefined) {
			// Return success - client will call updateSession() which triggers JWT callback
			return NextResponse.json({ 
				success: true, 
				activeOrgId: null
			});
		}

		// If orgId is provided, validate it's a string
		if (typeof orgId !== "string") {
			return NextResponse.json(
				{ error: "orgId must be a string or null" },
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

		// Return success - client will call updateSession() which triggers JWT callback

		return NextResponse.json({ success: true, activeOrgId: orgId });
	} catch (error) {
		console.error("Error switching actor:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
