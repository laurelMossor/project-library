/**
 * ProfilePicture - Displays avatar for a User or Page
 * Shows the actual avatar image when available, falls back to initials.
 * Uses shared initials utilities from utils/text.ts.
 */
import Link from "next/link";
import { CardEntity, isCardPage } from "@/lib/types/card";
import { getUserInitials, getPageInitials } from "@/lib/utils/text";
import { PUBLIC_PROFILE } from "@/lib/const/routes";

type ProfilePictureProps = {
	entity: CardEntity;
	size?: "sm" | "md" | "lg";
	className?: string;
	asLink?: boolean;
};

const sizeClasses = {
	sm: "w-8 h-8 text-xs",
	md: "w-12 h-12 text-sm",
	lg: "w-25 h-25 text-base",
};

function resolveEntity(entity: CardEntity) {
	if (isCardPage(entity)) {
		return {
			initials: getPageInitials(entity.name),
			href: PUBLIC_PROFILE(entity.handle),
			avatarUrl: entity.avatarImage?.url ?? null,
		};
	}
	return {
		initials: getUserInitials(entity),
		href: PUBLIC_PROFILE(entity.handle),
		avatarUrl: entity.avatarImage?.url ?? null,
	};
}

export function ProfilePicture({ entity, size = "md", className = "", asLink = true }: ProfilePictureProps) {
	const { initials, href, avatarUrl } = resolveEntity(entity);
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
