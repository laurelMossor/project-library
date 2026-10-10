import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { DomainError } from "@/lib/utils/server/domain-error";
import { unauthorized } from "@/lib/utils/errors";
import { getEffectivePrefs, resolveEmailIdentity } from "@/lib/utils/server/notification-preferences";

/**
 * GET the active identity's effective email preferences ({ master, categories }).
 * Saving goes through `updateNotificationPrefsAction`; this read stays for the settings panel's load.
 */
export async function GET() {
	const ctx = await getSessionContext();
	if (!ctx) return unauthorized();
	try {
		return NextResponse.json(await getEffectivePrefs(await resolveEmailIdentity(ctx)));
	} catch (err) {
		if (err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: 403 });
		throw err;
	}
}
