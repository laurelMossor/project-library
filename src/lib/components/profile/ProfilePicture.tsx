/**
 * ProfilePicture - Displays avatar for a User or Page.
 * Shows the uploaded photo when one exists, otherwise a generated avatar seeded by entity id.
 */
import Link from "next/link";
import { CardEntity, resolveCardIdentity } from "@/lib/types/card";
import { GeneratedAvatar } from "./GeneratedAvatar";

type ProfilePictureProps = {
	entity: CardEntity;
	size?: "sm" | "md" | "lg";
	className?: string;
	asLink?: boolean;
};

const sizeClasses = {
	sm: "w-8 h-8",
	md: "w-12 h-12",
	lg: "w-25 h-25",
};

export function ProfilePicture({ entity, size = "md", className = "", asLink = true }: ProfilePictureProps) {
	const { name, href } = resolveCardIdentity(entity);
	const avatarUrl = entity.avatarImage?.url ?? null;
	const sizeClass = sizeClasses[size];
	const baseClasses = `${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`;

	const content = avatarUrl ? (
		<img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
	) : (
		<GeneratedAvatar seed={entity.id} />
	);

	if (asLink) {
		return (
			<Link href={href} aria-label={name} className={`${baseClasses} hover:opacity-80 transition-opacity`}>
				{content}
			</Link>
		);
	}

	return (
		<div aria-label={name} className={baseClasses}>
			{content}
		</div>
	);
}
