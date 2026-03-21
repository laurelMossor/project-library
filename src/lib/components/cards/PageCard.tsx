"use client";

import { ReactNode } from "react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { EntityAvatar } from "@/lib/components/owner/EntityAvatar";
import { CardPage, getCardPageDisplayName } from "@/lib/types/card";
import { PUBLIC_PAGE } from "@/lib/const/routes";

type PageCardProps = {
	page: CardPage;
	// Optional badge to display (e.g., "Active", role)
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
 * PageCard - Reusable card for displaying a page in a list
 * Matches the PageSwitcher list item style
 */
export function PageCard({
	page,
	badge,
	actions,
	showViewButton = true,
	avatarSize = "sm",
	avatarAsLink = false,
}: PageCardProps) {
	const displayName = getCardPageDisplayName(page);

	return (
		<div className="flex items-center justify-between p-3 border rounded">
			<div className="flex items-center gap-3">
				<EntityAvatar page={page} size={avatarSize} asLink={avatarAsLink} />
				<div>
					<p className="font-medium">{displayName}</p>
					<p className="text-sm text-gray-500">@{page.slug}</p>
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
						href={PUBLIC_PAGE(page.slug)}
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
