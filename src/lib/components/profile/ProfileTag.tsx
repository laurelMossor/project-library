import { ReactNode } from "react";
import Link from "next/link";
import { CardEntity, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { ProfilePicture } from "./ProfilePicture";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";

export type ProfileTagProps = {
	entity: CardEntity;
	badge?: string;
	size?: "sm" | "md" | "lg";
	/** Whether the left section (avatar + name) links to the profile. Defaults true. */
	asLink?: boolean;
	actions?: ReactNode;
	className?: string;
	/**
	 * "default" (standard): shows @handle, badge inline to the right.
	 * "compact": no @handle, badge stacked below name, name wraps freely.
	 * Use compact in constrained widths (left tabs, dropdown switcher).
	 */
	variant?: "default" | "compact";
	/**
	 * "left" (default): content starts from the left edge (overrides button ancestor centering).
	 * "right": content is pushed to the right edge — use for right-side-adjacent left tabs.
	 */
	align?: "left" | "right";
};

export function ProfileTag({
	entity,
	badge,
	size = "sm",
	asLink = true,
	actions,
	className = "",
	variant = "default",
	align = "left",
}: ProfileTagProps) {
	const page = isCardPage(entity);
	const name = page ? entity.name : getCardUserDisplayName(entity);
	const handle = page ? entity.slug : entity.username;
	const href = page ? PUBLIC_PAGE(entity.slug) : PUBLIC_USER_PAGE(entity.username);
	const resolvedBadge = badge ?? (variant === "compact" && !page ? "me" : undefined);

	const avatar = <ProfilePicture entity={entity} size={size} asLink={false} />;

	const nameBlock =
		variant === "compact" ? (
			<div className="min-w-0">
				<p className="text-sm font-medium text-rich-brown leading-tight">{name}</p>
				{resolvedBadge && (
					<span className="text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey capitalize mt-1 inline-block">
						{resolvedBadge}
					</span>
				)}
			</div>
		) : (
			<div className="min-w-0">
				<p className="text-sm font-medium text-rich-brown leading-tight">{name}</p>
				<p className="text-xs text-dusty-grey">@{handle}</p>
			</div>
		);

	const alignClass = variant === "compact" ? "items-start" : "items-center";

	const leftSection = asLink ? (
		<Link href={href} className={`flex ${alignClass} gap-3 hover:opacity-80 transition-opacity min-w-0`}>
			{avatar}
			{nameBlock}
		</Link>
	) : (
		<div className={`flex ${alignClass} gap-3 min-w-0`}>
			{avatar}
			{nameBlock}
		</div>
	);

	// In compact mode badge lives inside nameBlock — right section only needed for actions
	const rightSection =
		variant === "compact"
			? actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>
			: (badge || actions) && (
					<div className="flex items-center gap-2 shrink-0">
						{badge && (
							<span className="text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey capitalize">
								{badge}
							</span>
						)}
						{actions}
					</div>
				);

	const justifyClass = align === "right" ? "justify-end" : "justify-between";
	const textAlignClass = align === "right" ? "text-right" : "text-left";

	return (
		<div className={`flex items-center ${justifyClass} ${textAlignClass} px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors ${className}`}>
			{leftSection}
			{rightSection}
		</div>
	);
}
