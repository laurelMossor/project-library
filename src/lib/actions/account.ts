"use server";

import { authedAction } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { markSetupComplete, removeAccount, removeUnfinishedAccount } from "@/lib/utils/server/user";

// Account lifecycle. The deletes don't refresh: the account is gone, and the caller signs out
// and leaves. The client does the sign-out (it clears the session cookie, same as before).

/**
 * Delete your account. `expectedPageIds` is the sole-admin page list the confirm modal showed;
 * a stale list is refused with `conflict` so the caller refetches instead of deleting more.
 */
export const deleteAccountAction = authedAction(
	async (ctx, input: { expectedPageIds: string[] }) => {
		const ids = input?.expectedPageIds;
		if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
			throw new DomainError("expectedPageIds must be a list of page ids");
		}
		await removeAccount(ctx.userId, ids);
	},
	{ refresh: false },
);

/** The user accepted the settings review. The caller does a full load next, so no refresh. */
export const completeSetupAction = authedAction<void>(
	async (ctx) => {
		await markSetupComplete(ctx.userId);
	},
	{ refresh: false },
);

/** Delete the account from the setup screen. Refused (`conflict`) once setup is finished. */
export const deleteUnfinishedAccountAction = authedAction<void>(
	async (ctx) => {
		await removeUnfinishedAccount(ctx.userId);
	},
	{ refresh: false },
);
