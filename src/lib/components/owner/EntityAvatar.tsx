/**
 * EntityAvatar - Displays avatar for a User or Page
 * Shows the actual avatar image when available, falls back to initials
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
	let avatarUrl: string | null = null;

	if ("user" in props && props.user) {
		initials = getCardUserInitials(props.user);
		href = PUBLIC_USER_PAGE(props.user.username);
		avatarUrl = props.user.avatarImage?.url ?? null;
	} else if ("page" in props && props.page) {
		initials = getCardPageInitials(props.page.name);
		href = PUBLIC_PAGE(props.page.slug);
		avatarUrl = props.page.avatarImage?.url ?? null;
	} else {
		return null;
	}

	const sizeClass = sizeClasses[size];
	const baseClasses = `${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`;
	const interactiveClasses = asLink ? "hover:opacity-80 transition-opacity" : "";

	const content = avatarUrl ? (
		<img
			src={avatarUrl}
			alt={initials}
			className="w-full h-full object-cover"
		/>
	) : (
		<span className="text-gray-600 font-medium">{initials}</span>
	);

	const bgClass = avatarUrl ? "" : "bg-soft-grey";

	if (asLink) {
		return (
			<Link
				href={href}
				className={`${baseClasses} ${bgClass} ${interactiveClasses}`}
			>
				{content}
			</Link>
		);
	}

	return (
		<div className={`${baseClasses} ${bgClass}`}>
			{content}
		</div>
	);
}
