import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/utils/errors";
import { prisma } from "@/lib/utils/server/prisma";

/** POST /api/me/setup-complete — the user accepted the settings review. */
export async function POST() {
	const session = await auth();
	if (!session?.user?.id) return unauthorized();

	await prisma.user.update({
		where: { id: session.user.id },
		data: { setupCompletedAt: new Date() },
	});
	return NextResponse.json({ ok: true });
}
