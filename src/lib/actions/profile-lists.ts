"use server";

import { publicAction } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { getViewerContext } from "@/lib/utils/server/visibility";
import { listProfileConnections } from "@/lib/utils/server/profile-lists";
import type { CardEntity } from "@/lib/types/card";
import type { ProfileList } from "@/lib/types/profile";

const LISTS: readonly ProfileList[] = ["followers", "following", "members"];

/**
 * Open one of a profile's lists (Followers / Following / Members) for the popovers on its counts.
 * Anyone may call it; the util refuses what the viewer may not see. Read-only, so no page refresh.
 */
export const listProfileConnectionsAction = publicAction(
	async (
		_ctx,
		input: { target: { type: "user" | "page"; id: string }; list: ProfileList },
	): Promise<CardEntity[]> => {
		const { target, list } = input ?? {};
		if ((target?.type !== "user" && target?.type !== "page") || typeof target.id !== "string" || !target.id) {
			throw new DomainError("Invalid profile");
		}
		if (!LISTS.includes(list)) throw new DomainError("Invalid list");
		return listProfileConnections(
			await getViewerContext(),
			{ type: target.type === "user" ? "USER" : "PAGE", id: target.id },
			list,
		);
	},
	{ refresh: false },
);
