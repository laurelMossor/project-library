/**
 * OwnerAvatar - Displays avatar for Owner, User, or Org
 * Supports three modes:
 * 1. Full owner object (PublicOwner)
 * 2. User only (CardUser)
 * 3. Org only (CardOrg)
 */
import Link from "next/link";
import { PublicOwner, getOwnerOrg, getOwnerUser, isOrgOwner } from "@/lib/utils/owner";
import { CardUser, CardOrg, getCardUserInitials, getCardOrgInitials } from "@/lib/types/card";
import { PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "@/lib/const/routes";

// Props for full owner mode
type OwnerModeProps = {
	owner: PublicOwner;
	user?: never;
	org?: never;
};

// Props for user-only mode
type UserModeProps = {
	owner?: never;
	user: CardUser;
	org?: never;
};

// Props for org-only mode
type OrgModeProps = {
	owner?: never;
	user?: never;
	org: CardOrg;
};

type OwnerAvatarProps = (OwnerModeProps | UserModeProps | OrgModeProps) & {
	size?: "sm" | "md" | "lg";
	className?: string;
	asLink?: boolean;
};

const sizeClasses = {
	sm: "w-8 h-8 text-xs",
	md: "w-12 h-12 text-sm",
	lg: "w-16 h-16 text-base",
};

export function OwnerAvatar(props: OwnerAvatarProps) {
	const { size = "md", className = "", asLink = true } = props;

	let initials: string;
	let href: string;

	if ("owner" in props && props.owner) {
		// Full owner mode
		const isOrg = isOrgOwner(props.owner);
		const org = getOwnerOrg(props.owner);
		const user = getOwnerUser(props.owner);

		if (!org && !user) return null;

		initials = isOrg && org 
			? getCardOrgInitials(org.name)
			: user 
			? getCardUserInitials(user)
			: "?";

		href = isOrg && org
			? PUBLIC_ORG_PAGE(org.slug)
			: user
			? PUBLIC_USER_PAGE(user.username)
			: "#";
	} else if ("user" in props && props.user) {
		// User-only mode
		initials = getCardUserInitials(props.user);
		href = PUBLIC_USER_PAGE(props.user.username);
	} else if ("org" in props && props.org) {
		// Org-only mode
		initials = getCardOrgInitials(props.org.name);
		href = PUBLIC_ORG_PAGE(props.org.slug);
	} else {
		return null;
	}

	const sizeClass = sizeClasses[size];
	const baseClasses = `${sizeClass} rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0 ${className}`;
	const interactiveClasses = asLink ? "hover:opacity-80 transition-opacity" : "";

	if (asLink) {
		return (
			<Link 
				href={href}
				className={`${baseClasses} ${interactiveClasses}`}
			>
				<span className="text-gray-600 font-medium">{initials}</span>
			</Link>
		);
	}

	return (
		<div className={baseClasses}>
			<span className="text-gray-600 font-medium">{initials}</span>
		</div>
	);
}
