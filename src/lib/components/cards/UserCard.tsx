"use client";

import { ReactNode } from "react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { EntityAvatar } from "@/lib/components/profile/EntityAvatar";
import { CardUser, getCardUserDisplayName } from "@/lib/types/card";
import { PUBLIC_USER_PAGE } from "@/lib/const/routes";

type UserCardProps = {
	user: CardUser;
	// Optional role/badge to display
	badge?: string;
	// Action buttons - can pass custom actions or use defaults
	actions?: ReactNode;
	// Show view button (default true)
	showViewButton?: boolean;
	// Avatar settings
	avatarSize?: "sm" | "md" | "lg";
	avatarAsLink?: boolean;
};

/**
 * UserCard - Reusable card for displaying a user in a list
 * Matches the PageSwitcher list item style
 */
export function UserCard({
	user,
	badge,
	actions,
	showViewButton = true,
	avatarSize = "sm",
	avatarAsLink = false,
}: UserCardProps) {
	const displayName = getCardUserDisplayName(user);

	return (
		<div className="flex items-center justify-between p-3 border rounded">
			<div className="flex items-center gap-3">
				<EntityAvatar user={user} size={avatarSize} asLink={avatarAsLink} />
				<div>
					<p className="font-medium">{displayName}</p>
					<p className="text-sm text-gray-500">@{user.username}</p>
				</div>
				{badge && (
					<span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded ml-2">
						{badge}
					</span>
				)}
			</div>
			<div className="flex gap-2">
				{showViewButton && (
					<ButtonLink
						href={PUBLIC_USER_PAGE(user.username)}
						variant="tertiary"
						size="sm"
					>
						View
					</ButtonLink>
				)}
				{actions}
			</div>
		</div>
	);
}
