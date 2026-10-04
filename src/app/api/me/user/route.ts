import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { unauthorized, notFound, badRequest, conflict } from "@/lib/utils/errors";
import { saveMyProfile } from "@/lib/utils/server/profile-update";
import { AccountDeleteConflict, deleteAccount } from "@/lib/utils/server/user";
import { removeStoragePaths } from "@/lib/utils/server/storage";
import type { SavePayload } from "@/lib/types/inline-edit";

export const maxDuration = 60;

/**
 * GET /api/me/user
 * Get current user's profile
 */
export async function GET() {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const user = await getUserById(session.user.id);

	if (!user) {
		return notFound("User not found");
	}

	return NextResponse.json(user);
}

/**
 * PUT /api/me/user
 * Update current user's profile. Accepts a structured SavePayload with scalar
 * fields and optional element operations.
 */
export async function PUT(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const userId = session.user.id;
	const body = (await request.json()) as SavePayload;

	try {
		const result = await saveMyProfile("USER", userId, body);
		if (!result.ok) {
			return badRequest(result.error);
		}
		return NextResponse.json(result.profile);
	} catch {
		return badRequest("Failed to update profile");
	}
}

/**
 * DELETE /api/me/user
 * Body: { expectedPageIds: string[] } — the sole-admin pages the modal listed.
 * 409 when that list is stale, so the client refetches instead of under-reporting.
 */
export async function DELETE(request: Request) {
	const session = await auth();
	if (!session?.user?.id) return unauthorized();

	let expectedPageIds: string[] = [];
	try {
		const body = await request.json();
		if (!Array.isArray(body?.expectedPageIds) || body.expectedPageIds.some((id: unknown) => typeof id !== "string")) {
			return badRequest("expectedPageIds must be a list of page ids");
		}
		expectedPageIds = body.expectedPageIds;
	} catch {
		return badRequest("expectedPageIds must be a list of page ids");
	}

	try {
		const paths = await deleteAccount(session.user.id, expectedPageIds);
		await removeStoragePaths(paths);
		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof AccountDeleteConflict) return conflict(error.message);
		console.error("DELETE /api/me/user error:", error);
		return badRequest("Failed to delete account");
	}
}
