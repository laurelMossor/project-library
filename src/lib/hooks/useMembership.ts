"use client";

import { joinPageAction, leavePageAction } from "@/lib/actions/membership";
import type { MembershipStatus } from "@/lib/types/connections";
import { isActingRole } from "@/lib/const/roles";
import { useAction } from "./useAction";

export type MembershipState = "none" | "requested" | "member" | "privileged";

/**
 * The join/leave/request toggle on a page (JoinButton). The viewer's standing comes from the
 * server (`status`) and the actions refresh the page, so the state follows the server:
 *   - "none"       no role, no request
 *   - "requested"  pending JOIN request
 *   - "member"     plain MEMBER (can leave)
 *   - "privileged" ADMIN/EDITOR (the server guards the last admin leaving)
 */
export function useMembership(pageId: string, status: MembershipStatus) {
	const join = useAction(joinPageAction);
	const leave = useAction(leavePageAction);

	const state: MembershipState = status.role
		? isActingRole(status.role)
			? "privileged"
			: "member"
		: status.requested
			? "requested"
			: "none";

	const toggle = async () => {
		if (join.pending || leave.pending) return;
		join.clearError();
		leave.clearError();
		// Leave (any role) or cancel a pending request; otherwise ask to join.
		await (state === "none" ? join.run({ pageId }) : leave.run({ pageId }));
	};

	return { state, toggling: join.pending || leave.pending, error: join.error ?? leave.error, toggle };
}
