import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AccountDeleteConflict, deleteAccount, isSetupComplete, SetupAlreadyFinished } from "@/lib/utils/server/user";
import { removeStoragePaths } from "@/lib/utils/server/storage";
import { unauthorized, notFound, conflict, badRequest } from "@/lib/utils/errors";

/**
 * DELETE /api/me/setup
 * Deletes the signed-in account only while setup is unfinished.
 * A finished account is refused so a second tab cannot delete it from this screen.
 */
export async function DELETE() {
	const session = await auth();
	if (!session?.user?.id) return unauthorized();

	const finished = await isSetupComplete(session.user.id);
	if (finished === null) return notFound("User not found");
	if (finished) return conflict(new SetupAlreadyFinished().message);

	try {
		const paths = await deleteAccount(session.user.id, [], { onlyIfUnfinished: true });
		await removeStoragePaths(paths);
		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof SetupAlreadyFinished) return conflict(error.message);
		if (error instanceof AccountDeleteConflict) return conflict(error.message);
		console.error("DELETE /api/me/setup error:", error);
		return badRequest("Failed to delete account");
	}
}
