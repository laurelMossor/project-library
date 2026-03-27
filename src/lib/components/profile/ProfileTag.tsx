import { ReactNode } from "react";
import Link from "next/link";
import { CardEntity, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { EntityAvatar } from "./EntityAvatar";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";

export type ProfileTagProps = {
	entity: CardEntity;
	badge?: string;
	size?: "sm" | "md" | "lg";
	/** Whether the left section (avatar + name) links to the profile. Defaults true. */
	asLink?: boolean;
	actions?: ReactNode;
	className?: string;
};

export function ProfileTag({
	entity,
	badge,
	size = "sm",
	asLink = true,
	actions,
	className = "",
}: ProfileTagProps) {
	const page = isCardPage(entity);
	const name = page ? entity.name : getCardUserDisplayName(entity);
	const handle = page ? entity.slug : entity.username;
	const href = page ? PUBLIC_PAGE(entity.slug) : PUBLIC_USER_PAGE(entity.username);

	const avatar = <EntityAvatar entity={entity} size={size} asLink={false} />;

	const nameBlock = (
		<div>
			<p className="text-sm font-medium text-rich-brown leading-tight">{name}</p>
			<p className="text-xs text-dusty-grey">@{handle}</p>
		</div>
	);

	const leftSection = asLink ? (
		<Link href={href} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
			{avatar}
			{nameBlock}
		</Link>
	) : (
		<div className="flex items-center gap-3">
			{avatar}
			{nameBlock}
		</div>
	);

	return (
		<div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors ${className}`}>
			{leftSection}
			{(badge || actions) && (
				<div className="flex items-center gap-2">
					{badge && (
						<span className="text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey capitalize">
							{badge}
						</span>
					)}
					{actions}
				</div>
			)}
		</div>
	);
}
