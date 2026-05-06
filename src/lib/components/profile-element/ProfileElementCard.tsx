"use client";

import type { ProfileElementItem, ProfileElementKind } from "@/lib/types/profile-element";

// ─── Per-kind read-only renderers ─────────────────────────────────────────

function SocialLinkDisplay({ element }: { element: ProfileElementItem }) {
	let domainLabel = element.label;
	if (!domainLabel && element.url) {
		try {
			domainLabel = new URL(element.url).hostname.replace(/^www\./, "");
		} catch {
			domainLabel = element.url;
		}
	}

	return (
		<a
			href={element.url ?? element.value}
			target="_blank"
			rel="noopener noreferrer"
			className="flex items-center gap-2 text-moss-green hover:text-rich-brown transition-colors group"
			onClick={(e) => e.stopPropagation()}
		>
			<span className="text-sm font-medium">{domainLabel ?? element.value}</span>
			<span className="text-xs opacity-0 group-hover:opacity-60 transition-opacity">↗</span>
		</a>
	);
}

function CtaDisplay({ element }: { element: ProfileElementItem }) {
	return (
		<div className="flex flex-col gap-1">
			{element.label && (
				<p className="text-xs font-semibold uppercase tracking-wider text-dusty-grey">
					{element.label}
				</p>
			)}
			<p className="font-semibold text-base">{element.value}</p>
			{element.caption && (
				<p className="text-sm text-dusty-grey">{element.caption}</p>
			)}
			{element.url && (
				<a
					href={element.url}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-2 inline-block text-sm font-medium text-white bg-moss-green rounded-full px-4 py-1.5 hover:bg-rich-brown transition-colors self-start"
					onClick={(e) => e.stopPropagation()}
				>
					{element.label ?? "Learn more"} →
				</a>
			)}
		</div>
	);
}

function TextDisplay({ element }: { element: ProfileElementItem }) {
	return (
		<div className="flex flex-col gap-1">
			{element.label && (
				<p className="text-xs font-medium text-dusty-grey uppercase tracking-wider">
					{element.label}
				</p>
			)}
			<p className="text-sm whitespace-pre-wrap">{element.value}</p>
			{element.caption && (
				<p className="text-xs text-dusty-grey mt-0.5">{element.caption}</p>
			)}
		</div>
	);
}

// ─── Shared card frame ────────────────────────────────────────────────────

type ProfileElementCardProps = {
	element: ProfileElementItem;
	isPendingDelete?: boolean;
	isEditing?: boolean;
	editContent?: React.ReactNode;
	/** Controls slot rendered to the right of the content (e.g. trash icon). */
	actionSlot?: React.ReactNode;
	/** When true, the card body is clickable (triggers edit mode). */
	onClick?: () => void;
};

const KIND_DISPLAY: Record<ProfileElementKind, React.ComponentType<{ element: ProfileElementItem }>> = {
	SOCIAL_LINK: SocialLinkDisplay,
	CTA: CtaDisplay,
	TEXT: TextDisplay,
};

export function ProfileElementCard({
	element,
	isPendingDelete = false,
	isEditing = false,
	editContent,
	actionSlot,
	onClick,
}: ProfileElementCardProps) {
	const Display = KIND_DISPLAY[element.kind];

	return (
		<div
			className={`relative border rounded-lg p-3 transition-all ${
				isPendingDelete
					? "opacity-40 bg-gray-100 pointer-events-none"
					: isEditing
					? "ring-1 ring-moss-green"
					: onClick
					? "cursor-pointer hover:bg-melon-green/5 group"
					: ""
			}`}
			onClick={!isEditing ? onClick : undefined}
		>
			<div className="flex items-start gap-2">
				<div className="flex-1 min-w-0">
					{isEditing && editContent ? editContent : <Display element={element} />}
				</div>
				{!isPendingDelete && actionSlot && (
					<div className="flex-shrink-0">{actionSlot}</div>
				)}
			</div>
		</div>
	);
}
