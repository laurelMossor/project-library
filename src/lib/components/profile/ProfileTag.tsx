import { ReactNode } from "react";
import Link from "next/link";
import { CardEntity, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { ProfilePicture } from "./ProfilePicture";
import { PUBLIC_PROFILE } from "@/lib/const/routes";

export type ProfileTagProps = {
	entity: CardEntity;
	/** A string renders as the standard bordered chip; any other node renders as given. Never defaulted. */
	badge?: ReactNode;
	size?: "sm" | "md" | "lg";
	/** Whether the whole tag links to the profile. Defaults true. */
	asLink?: boolean;
	/** Buttons/menus. They sit above the tag's link, so they stay their own click targets. */
	actions?: ReactNode;
	/** Extra text on the same line as the name, e.g. " › Page" for a post placed on a page. */
	trailing?: ReactNode;
	/** Card variant only: content under the name (headline, interests). */
	details?: ReactNode;
	className?: string;
	/**
	 * "default" (standard): shows @handle, badge inline to the right.
	 * "compact": no @handle, badge stacked below name, name wraps freely.
	 *   Use compact in constrained widths (left tabs, dropdown switcher).
	 * "card": the large layout — avatar beside name, @handle, `details`, then `actions` underneath.
	 */
	variant?: "default" | "compact" | "card";
	/**
	 * "left" (default): content starts from the left edge (overrides button ancestor centering).
	 * "right": content is pushed to the right edge — use for right-side-adjacent left tabs.
	 */
	align?: "left" | "right";
};

const badgeChipClass = "text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey";

function Badge({ badge, className = "" }: { badge: ReactNode; className?: string }) {
	return typeof badge === "string" ? <span className={`${badgeChipClass} ${className}`}>{badge}</span> : <>{badge}</>;
}

export function ProfileTag({
	entity,
	badge,
	size = "sm",
	asLink = true,
	actions,
	trailing,
	details,
	className = "",
	variant = "default",
	align = "left",
}: ProfileTagProps) {
	const page = isCardPage(entity);
	const name = page ? entity.name : getCardUserDisplayName(entity);
	const handle = entity.handle;

	const picture = <ProfilePicture entity={entity} size={size} asLink={false} />;
	// One link per tag: the name's link is stretched over the whole tag (`after:inset-0`), so a click
	// anywhere opens the profile. Anything interactive inside (trailing links, badges that are
	// selectors, actions) is lifted above it with `relative z-10`. No links nested in links.
	// `truncate` clips overflow, so it stays on the name text. The stretched `::after` lives on the
	// link, outside that span, or the card's padding would swallow the click.
	const stretchLinkClass = "min-w-0 after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none";
	const nameText = asLink ? (
		<Link href={PUBLIC_PROFILE(handle)} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none">
			{name}
		</Link>
	) : name;
	const truncatedName = asLink ? (
		<Link href={PUBLIC_PROFILE(handle)} className={stretchLinkClass}>
			<span className="block truncate">{name}</span>
		</Link>
	) : (
		<span className="block min-w-0 truncate">{name}</span>
	);
	const trailingNode = trailing && <span className="relative z-10">{trailing}</span>;
	const linkedClass = asLink ? "relative focus-within:ring-2 focus-within:ring-rich-brown/20" : "";

	if (variant === "card") {
		return (
			<div className={`${linkedClass} flex items-start gap-4 p-4 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white hover:shadow-md transition-shadow ${className}`}>
				<div className="shrink-0">{picture}</div>
				<div className="min-w-0 flex-1 flex flex-col gap-1">
					<p className="flex min-w-0 items-baseline text-sm font-medium text-rich-brown leading-tight">{truncatedName}{trailingNode}</p>
					<div className="flex items-center gap-2 min-w-0">
						<p className="text-xs text-dusty-grey truncate">@{handle}</p>
						{badge && <span className="relative z-10 shrink-0"><Badge badge={badge} /></span>}
					</div>
					{details}
					{actions && <div className="relative z-10 flex flex-wrap items-center gap-2 mt-2">{actions}</div>}
				</div>
			</div>
		);
	}

	const nameBlock =
		variant === "compact" ? (
			<div className="min-w-0">
				<p className="flex min-w-0 items-baseline text-sm font-medium text-rich-brown leading-tight">{truncatedName}{trailingNode}</p>
				{badge && <span className="relative z-10 inline-block mt-1"><Badge badge={badge} /></span>}
			</div>
		) : (
			<div className="min-w-0">
				<p className="text-sm font-medium text-rich-brown leading-tight">{nameText}{trailingNode}</p>
				<p className="text-xs text-dusty-grey">@{handle}</p>
			</div>
		);

	const alignClass = variant === "compact" ? "items-start" : "items-center";

	// In compact mode the badge lives inside nameBlock — the right section is only for actions.
	const rightBadge = variant === "compact" ? null : badge;
	const rightSection = (rightBadge || actions) && (
		<div className="relative z-10 flex items-center gap-2 shrink-0">
			{rightBadge && <Badge badge={rightBadge} />}
			{actions}
		</div>
	);

	const justifyClass = align === "right" ? "justify-end" : "justify-between";
	const textAlignClass = align === "right" ? "text-right" : "text-left";

	return (
		<div className={`${linkedClass} flex items-center ${justifyClass} ${textAlignClass} px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors ${className}`}>
			<div className={`flex ${alignClass} gap-3 min-w-0`}>
				<span className="shrink-0">{picture}</span>
				{nameBlock}
			</div>
			{rightSection}
		</div>
	);
}
