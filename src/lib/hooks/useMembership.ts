"use client";

import { useState, useEffect } from "react";
import { API_PAGE_MEMBERSHIP } from "@/lib/const/routes";

export type Role = "ADMIN" | "EDITOR" | "MEMBER" | null;
export type MembershipState = "none" | "requested" | "member" | "privileged";

/**
 * Single source of truth for the join/leave/request toggle on a page, shared by
 * JoinButton and the connections Membership surface. Resolves to:
 *   - "none"       no role, no request
 *   - "requested"  pending JOIN request (PRIVATE page)
 *   - "member"     plain MEMBER (can leave)
 *   - "privileged" ADMIN/EDITOR (leave handled elsewhere / guarded server-side)
 */
export function useMembership(pageId: string, enabled = true) {
	const [role, setRole] = useState<Role>(null);
	const [requested, setRequested] = useState(false);
	const [loading, setLoading] = useState(true);
	const [toggling, setToggling] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setLoading(false);
			return;
		}
		let active = true;
		fetch(API_PAGE_MEMBERSHIP(pageId))
			.then((r) => r.json())
			.then((d) => {
				if (!active) return;
				setRole(d.role ?? null);
				setRequested(!!d.requested);
			})
			.catch(() => {})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [pageId, enabled]);

	const state: MembershipState =
		role === "ADMIN" || role === "EDITOR"
			? "privileged"
			: role === "MEMBER"
				? "member"
				: requested
					? "requested"
					: "none";

	const toggle = async () => {
		if (toggling) return;
		setToggling(true);
		try {
			if (state === "member" || state === "requested" || state === "privileged") {
				// Leave (any role — the server guards the last admin), or cancel a pending request.
				const res = await fetch(API_PAGE_MEMBERSHIP(pageId), { method: "DELETE" });
				if (res.ok) {
					setRole(null);
					setRequested(false);
				}
			} else {
				const res = await fetch(API_PAGE_MEMBERSHIP(pageId), { method: "POST" });
				const data = await res.json().catch(() => ({}));
				if (res.ok) {
					if (data.status === "requested") setRequested(true);
					else setRole("MEMBER");
				}
			}
		} catch {
			// Leave state unchanged on error
		} finally {
			setToggling(false);
		}
	};

	return { role, state, loading, toggling, toggle };
}
