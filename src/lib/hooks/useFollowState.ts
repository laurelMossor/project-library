"use client";

import { useState, useEffect } from "react";
import { API_FOLLOWS, API_FOLLOW } from "@/lib/const/routes";

export type FollowState = "none" | "following" | "requested";

/**
 * Single source of truth for the follow/request toggle, shared by ProfileButtons
 * and the connections Followers/Following surfaces. Reads the current state
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
	const [toggling, setToggling] = useState(false);

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
		if (toggling) return;
		setToggling(true);
		try {
			if (state === "following" || state === "requested") {
				// Unfollow, or cancel a pending request — both DELETE the follow target.
				await fetch(`${API_FOLLOW(entityId)}?type=${entityType}`, { method: "DELETE" });
				setState("none");
			} else {
				const body =
					entityType === "user" ? { followingUserId: entityId } : { followingPageId: entityId };
				const res = await fetch(API_FOLLOWS, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
				const data = await res.json().catch(() => ({}));
				setState(data.status === "requested" ? "requested" : "following");
			}
		} catch {
			// Leave state unchanged on error
		} finally {
			setToggling(false);
		}
	};

	return { state, loading, toggling, toggle };
}
