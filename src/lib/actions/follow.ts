"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { followTarget, removeFollower, unfollowTarget } from "@/lib/utils/server/follow";
import type { EntityRef } from "@/lib/utils/server/activity";

export type FollowState = "none" | "following" | "requested";

type FollowTargetInput = { type: "user" | "page"; id: string };

/** Validate a client-supplied follow target and map it to the entity ref the utils speak. */
function toEntityRef(target: FollowTargetInput | undefined): EntityRef {
	if ((target?.type !== "user" && target?.type !== "page") || typeof target.id !== "string") {
		throw new DomainError("Invalid follow target");
	}
	return { type: target.type === "user" ? "USER" : "PAGE", id: target.id };
}

/**
 * Follow (`follow: true`) or unfollow / cancel a request (`follow: false`) a user or page.
 * The wrapper refreshes the page, so server-rendered follower counts update with it.
 */
export const setFollow = authedAction(
	async (ctx, input: { target: FollowTargetInput; follow: boolean }): Promise<FollowState> => {
		const { target, follow } = input ?? {};
		const ref = toEntityRef(target);

		if (!follow) {
			await unfollowTarget(ctx.userId, ref);
			return "none";
		}
		const result = await followTarget(ctx.userId, ref);
		if (result.ok) return result.status === "requested" ? "requested" : "following";
		if (result.reason === "already_following") return "following";
		throw new DomainError(
			result.reason === "self" ? "You can't follow yourself" : "Not found",
			result.reason === "self" ? "invalid" : "not_found",
		);
	},
);

/** Remove a follower (by follow edge id) from your own profile, or from a page you manage. */
export const removeFollowerAction = authedAction(
	async (ctx, input: { target: FollowTargetInput; followId: string }) => {
		await removeFollower(ctx.userId, toEntityRef(input?.target), requireId(input?.followId, "follower"));
	},
);
