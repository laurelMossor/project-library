"use client";

import { useState, useEffect } from "react";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { UserPlusSignIcon, UserMinusSignIcon } from "@/lib/components/icons/icons";
import { API_PAGE_MEMBERSHIP } from "@/lib/const/routes";

type Role = "ADMIN" | "EDITOR" | "MEMBER" | null;

type JoinButtonProps = {
	pageId: string;
};

/**
 * Self-service Join/Leave button for page profiles.
 * Only visible when the viewer is logged in and acting as their personal identity (not as a page).
 */
export function JoinButton({ pageId }: JoinButtonProps) {
	const { currentUser, activePageId } = useActiveProfile();

	const [role, setRole] = useState<Role>(null);
	const [loading, setLoading] = useState(true);
	const [toggling, setToggling] = useState(false);

	const loggedIn = !!currentUser;
	// Hide entirely when acting as a page
	const actingAsPage = !!activePageId;

	useEffect(() => {
		if (!loggedIn || actingAsPage) {
			setLoading(false);
			return;
		}
		fetch(API_PAGE_MEMBERSHIP(pageId))
			.then((r) => r.json())
			.then((d) => setRole(d.role ?? null))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [pageId, loggedIn, actingAsPage]);

	if (!loggedIn || actingAsPage || loading) return null;

	const isMember = role === "MEMBER";
	const isPrivileged = role === "ADMIN" || role === "EDITOR";

	const handleToggle = async () => {
		if (toggling || isPrivileged) return;
		setToggling(true);
		try {
			if (isMember) {
				const res = await fetch(API_PAGE_MEMBERSHIP(pageId), { method: "DELETE" });
				if (res.ok) setRole(null);
			} else {
				const res = await fetch(API_PAGE_MEMBERSHIP(pageId), { method: "POST" });
				if (res.ok) setRole("MEMBER");
			}
		} catch {
			// Leave state unchanged on error
		} finally {
			setToggling(false);
		}
	};

	const label = toggling ? "..." : isMember || isPrivileged ? "Leave group" : "Join";
	const icon = isMember || isPrivileged
		? <UserMinusSignIcon className="w-4 h-4" />
		: <UserPlusSignIcon className="w-4 h-4" />;

	return (
		<TransparentCTAButton
			label={label}
			icon={icon}
			onClick={handleToggle}
			disabled={toggling || isPrivileged}
			className="w-full"
		/>
	);
}
