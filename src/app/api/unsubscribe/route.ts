import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { verifyUnsubscribeToken } from "@/lib/utils/server/unsubscribe-token";
import { setMaster } from "@/lib/utils/server/notification-preferences";

// The deliberate confirm step of the unsubscribe flow (the GET page mutates nothing — prefetch-safe).
// The stateless token is the authorization, so no session is required.
export async function POST(request: Request) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid request." }, { status: 400 });
	}
	const token = typeof (body as { token?: unknown })?.token === "string" ? (body as { token: string }).token : "";
	const target = verifyUnsubscribeToken(token);
	if (!target) {
		return NextResponse.json({ error: "This unsubscribe link is invalid or expired." }, { status: 400 });
	}

	// Flip that identity's per-context email master off (idempotent).
	await setMaster({ recipientUserId: target.recipientUserId, contextPageId: target.contextPageId }, false);

	let label = "your personal";
	if (target.contextPageId) {
		const page = await prisma.page.findUnique({ where: { id: target.contextPageId }, select: { name: true } });
		label = page ? page.name : "this page's";
	}
	return NextResponse.json({ ok: true, label });
}
