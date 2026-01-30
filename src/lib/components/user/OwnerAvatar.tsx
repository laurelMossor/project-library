/**
 * OwnerAvatar - Displays avatar for Owner (User or Org)
 * Prioritizes Org avatar/name over User when Owner is an Org type
 */
import Link from "next/link";
import { PublicOwner, getOwnerOrg, getOwnerUser, isOrgOwner, getOwnerHandle } from "@/lib/utils/owner";
import { getInitials } from "@/lib/utils/text";
import { PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "@/lib/const/routes";

type OwnerAvatarProps = {
	owner: PublicOwner;
	size?: "sm" | "md" | "lg";
	className?: string;
};

const sizeClasses = {
	sm: "w-8 h-8 text-xs",
	md: "w-12 h-12 text-sm",
	lg: "w-16 h-16 text-base",
};

/**
 * Get initials for an org (uses first 2-3 letters of org name)
 */
function getOrgInitials(orgName: string): string {
	const words = orgName.trim().split(/\s+/);
	if (words.length >= 2) {
		// Use first letter of first two words
		return (words[0][0] + words[1][0]).toUpperCase();
	}
	// Use first 2-3 letters of single word org name
	const name = words[0];
	if (name.length >= 3) {
		return name.substring(0, 3).toUpperCase();
	}
	return name.substring(0, 2).toUpperCase();
}

export function OwnerAvatar({ owner, size = "md", className = "" }: OwnerAvatarProps) {
	const isOrg = isOrgOwner(owner);
	const org = getOwnerOrg(owner);
	const user = getOwnerUser(owner);
	const handle = getOwnerHandle(owner);

	if (!org && !user) return null;

	// Prioritize org over user
	const displayEntity = isOrg && org ? org : user;
	const initials = isOrg && org 
		? getOrgInitials(org.name)
		: user 
		? getInitials(user)
		: "?";

	const href = isOrg && org
		? PUBLIC_ORG_PAGE(org.slug)
		: user
		? PUBLIC_USER_PAGE(user.username)
		: "#";

	const sizeClass = sizeClasses[size];

	return (
		<Link 
			href={href}
			className={`${sizeClass} rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity ${className}`}
		>
			<span className="text-gray-600 font-medium">{initials}</span>
		</Link>
	);
}
