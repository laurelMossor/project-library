/**
 * EntityAvatar - Displays avatar for a User or Page
 * Supports two modes:
 * 1. User mode (CardUser)
 * 2. Page mode (CardPage)
 */
import Link from "next/link";
import { CardUser, CardPage, getCardUserInitials, getCardPageInitials } from "@/lib/types/card";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";

// Props for user mode
type UserModeProps = {
	user: CardUser;
	page?: never;
};

// Props for page mode
type PageModeProps = {
	user?: never;
	page: CardPage;
};

type EntityAvatarProps = (UserModeProps | PageModeProps) & {
	size?: "sm" | "md" | "lg";
	className?: string;
	asLink?: boolean;
};

const sizeClasses = {
	sm: "w-8 h-8 text-xs",
	md: "w-12 h-12 text-sm",
	lg: "w-16 h-16 text-base",
};

export function EntityAvatar(props: EntityAvatarProps) {
	const { size = "md", className = "", asLink = true } = props;

	let initials: string;
	let href: string;

	if ("user" in props && props.user) {
		initials = getCardUserInitials(props.user);
		href = PUBLIC_USER_PAGE(props.user.username);
	} else if ("page" in props && props.page) {
		initials = getCardPageInitials(props.page.name);
		href = PUBLIC_PAGE(props.page.slug);
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
