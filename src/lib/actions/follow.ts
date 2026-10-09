"use server";

import { authedAction } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { followTarget, unfollowTarget } from "@/lib/utils/server/follow";

export type FollowState = "none" | "following" | "requested";

/**
 * Follow (`follow: true`) or unfollow / cancel a request (`follow: false`) a user or page.
 * The wrapper refreshes the page, so server-rendered follower counts update with it.
 */
export const setFollow = authedAction(
	async (ctx, input: { target: { type: "user" | "page"; id: string }; follow: boolean }): Promise<FollowState> => {
		const { target, follow } = input ?? {};
		if ((target?.type !== "user" && target?.type !== "page") || typeof target.id !== "string") {
			throw new DomainError("Invalid follow target");
		}
		const ref = { type: target.type === "user" ? ("USER" as const) : ("PAGE" as const), id: target.id };

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
