"use client";

import { ReactNode } from "react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { OwnerAvatar } from "@/lib/components/owner/OwnerAvatar";
import { CardOrg, getCardOrgDisplayName } from "@/lib/types/card";
import { PUBLIC_ORG_PAGE } from "@/lib/const/routes";

type OrgCardProps = {
	org: CardOrg;
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
 * OrgCard - Reusable card for displaying an org in a list
 * Matches the OrgSwitcher list item style
 */
export function OrgCard({
	org,
	badge,
	actions,
	showViewButton = true,
	avatarSize = "sm",
	avatarAsLink = false,
}: OrgCardProps) {
	const displayName = getCardOrgDisplayName(org);

	return (
		<div className="flex items-center justify-between p-3 border rounded">
			<div className="flex items-center gap-3">
				<OwnerAvatar org={org} size={avatarSize} asLink={avatarAsLink} />
				<div>
					<p className="font-medium">{displayName}</p>
					<p className="text-sm text-gray-500">@{org.slug}</p>
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
						href={PUBLIC_ORG_PAGE(org.slug)}
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
