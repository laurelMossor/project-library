"use client";

import { useState, useEffect } from "react";
import { API_FOLLOW } from "@/lib/const/routes";
import { setFollow, type FollowState } from "@/lib/actions/follow";
import { useAction } from "./useAction";

/**
 * Single source of truth for the follow/request toggle (ProfileButtons). Reads the current state
 * (following / pending request / none) and toggles it:
 *   - PUBLIC/UNLISTED target → instant follow
 *   - PRIVATE target         → pending request ("requested")
 *   - toggling off           → unfollow OR cancel the pending request
 */
export function useFollowState(
	entityId: string,
	entityType: "user" | "page",
	enabled = true,
) {
	const [state, setState] = useState<FollowState>("none");
	const [loading, setLoading] = useState(true);
	const { run, pending } = useAction(setFollow);

	useEffect(() => {
		if (!enabled) {
			setLoading(false);
			return;
		}
		let active = true;
		fetch(`${API_FOLLOW(entityId)}?type=${entityType}`)
			.then((r) => r.json())
			.then((d) => {
				if (active) setState(d.isFollowing ? "following" : d.requested ? "requested" : "none");
			})
			.catch(() => {})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [entityId, entityType, enabled]);

	const toggle = async () => {
		if (pending) return;
		// Unfollow also cancels a pending request. The action refreshes the page,
		// so server-rendered follower counts update in the same round trip.
		const result = await run({ target: { type: entityType, id: entityId }, follow: state === "none" });
		if (result.ok) setState(result.data);
	};

	return { state, loading, toggling: pending, toggle };
}
