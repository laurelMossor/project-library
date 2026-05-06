"use client";

import type { ProfileElementItem, ProfileElementKind } from "@/lib/types/profile-element";

// ─── Platform detection ───────────────────────────────────────────────────

const PLATFORMS: Record<string, string> = {
	"instagram.com": "Instagram",
	"twitter.com": "Twitter / X",
	"x.com": "Twitter / X",
	"github.com": "GitHub",
	"linkedin.com": "LinkedIn",
	"youtube.com": "YouTube",
	"tiktok.com": "TikTok",
	"facebook.com": "Facebook",
	"threads.net": "Threads",
	"bsky.app": "Bluesky",
};

// ─── Per-kind read-only renderers ─────────────────────────────────────────

function LinkDisplay({ element }: { element: ProfileElementItem }) {
	const url = element.url ?? element.value;
	let displayLabel = element.label;
	if (!displayLabel) {
		try {
			const hostname = new URL(url).hostname.replace(/^www\./, "");
			displayLabel = PLATFORMS[hostname] ?? hostname;
		} catch {
			displayLabel = url;
		}
	}

	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="flex items-center gap-2 text-moss-green hover:text-rich-brown transition-colors group/link"
			onClick={(e) => e.stopPropagation()}
		>
			<span className="text-sm font-medium">{displayLabel}</span>
			<span className="text-xs opacity-0 group-hover/link:opacity-60 transition-opacity">↗</span>
		</a>
	);
}

function TextDisplay({ element }: { element: ProfileElementItem }) {
	return (
		<div className="flex flex-col gap-0.5">
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

// ─── Shared element wrapper ──────────────────────────────────────────────

type ProfileElementCardProps = {
	element: ProfileElementItem;
	isPendingDelete?: boolean;
	isEditing?: boolean;
	editContent?: React.ReactNode;
	actionSlot?: React.ReactNode;
	onClick?: () => void;
};

const KIND_DISPLAY: Record<ProfileElementKind, React.ComponentType<{ element: ProfileElementItem }>> = {
	LINK: LinkDisplay,
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

	if (isPendingDelete) {
		return (
			<div className="opacity-40 pointer-events-none">
				<Display element={element} />
			</div>
		);
	}

	if (isEditing && editContent) {
		return (
			<div className="flex items-start gap-2">
				<div className="flex-1 min-w-0">{editContent}</div>
				{actionSlot && <div className="flex-shrink-0 pt-0.5">{actionSlot}</div>}
			</div>
		);
	}

	if (onClick) {
		return (
			<div
				className="group relative cursor-pointer rounded-md transition-colors hover:bg-melon-green/10"
				onClick={onClick}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
				}}
			>
				<Display element={element} />
				<span className="absolute top-0 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-misty-forest/60 text-xs pointer-events-none">
					Edit
				</span>
			</div>
		);
	}

	return <Display element={element} />;
}
