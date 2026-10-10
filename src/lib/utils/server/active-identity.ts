// ⚠️ SERVER-ONLY: switching which identity (personal or a managed page) the session acts as.

import { unstable_update } from "@/lib/auth";
import { DomainError } from "./domain-error";
import { canSetActivePage } from "./session";

/**
 * Point the session at a page (or back at the personal profile with `null`). The active page
 * lives in the session token, so this validates the caller may act as it, then rewrites the
 * session cookie. The `jwt` callback re-checks the same rule before it persists the id.
 */
export async function setActiveIdentity(userId: string, pageId: string | null): Promise<void> {
	if (pageId !== null && !(await canSetActivePage(userId, pageId))) {
		throw new DomainError("You cannot act as this page", "forbidden");
	}
	// `activePageId` sits at the top level of the update payload (see the `jwt` callback in auth.ts).
	await unstable_update({ activePageId: pageId } as never);
}
