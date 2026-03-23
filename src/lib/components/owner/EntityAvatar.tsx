/**
 * EntityAvatar - Displays avatar for a User or Page
 * Shows the actual avatar image when available, falls back to initials.
 * Uses shared initials utilities from utils/text.ts.
 */
import Link from "next/link";
import { CardUser, CardPage } from "@/lib/types/card";
import { getUserInitials, getPageInitials } from "@/lib/utils/text";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";

type UserModeProps = { user: CardUser; page?: never };
type PageModeProps = { user?: never; page: CardPage };

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

// Derive display properties from the entity prop
function resolveEntity(props: UserModeProps | PageModeProps) {
	if (props.user) {
		return {
			initials: getUserInitials(props.user),
			href: PUBLIC_USER_PAGE(props.user.username),
			avatarUrl: props.user.avatarImage?.url ?? null,
		};
	}
	if (props.page) {
		return {
			initials: getPageInitials(props.page.name),
			href: PUBLIC_PAGE(props.page.slug),
			avatarUrl: props.page.avatarImage?.url ?? null,
		};
	}
	return null;
}

export function EntityAvatar(props: EntityAvatarProps) {
	const { size = "md", className = "", asLink = true } = props;

	const entity = resolveEntity(props);
	if (!entity) return null;

	const { initials, href, avatarUrl } = entity;
	const sizeClass = sizeClasses[size];
	const baseClasses = `${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`;
	const bgClass = avatarUrl ? "" : "bg-soft-grey";

	const content = avatarUrl ? (
		<img src={avatarUrl} alt={initials} className="w-full h-full object-cover" />
	) : (
		<span className="text-gray-600 font-medium">{initials}</span>
	);

	if (asLink) {
		return (
			<Link href={href} className={`${baseClasses} ${bgClass} hover:opacity-80 transition-opacity`}>
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
