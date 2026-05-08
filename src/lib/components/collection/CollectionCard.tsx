"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnyCollectionItem, CollectionItem, isEvent, isAbout, isPastEvent, AboutCollectionItem } from "@/lib/types/collection";
import type { EventItem } from "@/lib/types/event";
import { ProfilePicture } from "../profile/ProfilePicture";
import { Tags } from "../tag/Tag";
import { truncateText } from "@/lib/utils/text";
import { formatDateTime } from "@/lib/utils/datetime";
import ImageCarousel from "../images/ImageCarousel";
import { EVENT_DETAIL, POST_DETAIL, PUBLIC_PROFILE, PROFILE_ABOUT } from "@/lib/const/routes";
import { getCardUserDisplayName } from "@/lib/types/card";
import { AtSignIcon, PinIcon } from "../icons/icons";

const MAX_PINNED = 3;

export type PinConfig = {
	currentUserId: string;
	activePageId?: string | null;
	pinnedCount: number;
};

type CollectionCardProps = {
	item: AnyCollectionItem;
	truncate?: boolean;
	showCaptions?: boolean;
	pinConfig?: PinConfig;
};

// TODO: rethink about card treatment
function AboutCard({ item }: { item: AboutCollectionItem }) {
	return (
		<Link
			href={PROFILE_ABOUT(item.handle)}
			className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col gap-2 no-underline"
		>
			<p className="text-xs font-medium uppercase tracking-wide text-dusty-grey">About</p>
			<h2 className="text-xl font-semibold">About {item.displayName}</h2>
			{item.excerpt && (
				<p className="text-warm-grey text-sm line-clamp-3">{item.excerpt}</p>
			)}
			<span className="text-sm text-moss-green hover:text-rich-brown transition-colors mt-auto">
				Read more →
			</span>
		</Link>
	);
}

export function CollectionCard({ item, truncate = true, showCaptions = false, pinConfig }: CollectionCardProps) {
	const router = useRouter();

	if (isAbout(item)) {
		return <AboutCard item={item} />;
	}

	const ri = item as CollectionItem;
	const isEventItem = isEvent(item);
	const ev = isEventItem ? (ri as EventItem) : null;
	const detailUrl = isEventItem ? EVENT_DETAIL(ri.id) : POST_DETAIL(ri.id);

	const displayName = ri.page ? ri.page.name : getCardUserDisplayName(ri.user);
	const handle = ri.page ? ri.page.handle : ri.user.handle;
	const profileHref = PUBLIC_PROFILE(handle);

	const isPinned = Boolean(ri.pinnedAt);
	const isDraft = ri.status === "DRAFT";
	const isPast = isPastEvent(ri);
	const canPin = !!pinConfig && (
		pinConfig.currentUserId === ri.userId ||
		(ri.page !== null && ri.page?.id === pinConfig.activePageId)
	);
	const atPinLimit = pinConfig ? pinConfig.pinnedCount >= MAX_PINNED && !isPinned : false;
	const apiEndpoint = isEventItem ? `/api/events/${ri.id}` : `/api/posts/${ri.id}`;

	async function handleTogglePin() {
		if (atPinLimit) return;
		try {
			const res = await fetch(apiEndpoint, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pinnedAt: isPinned ? null : new Date().toISOString() }),
			});
			if (res.ok) router.refresh();
		} catch {
			// silent fail — user can retry
		}
	}

	return (
		<div
			className={`group border rounded p-4 hover:shadow-lg transition-shadow flex flex-col cursor-pointer${isPast ? " opacity-50" : ""}`}
			onClick={() => router.push(detailUrl)}
		>
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					<ProfilePicture entity={ri.page ?? ri.user} size="md" />
					<div className="flex-1 min-w-0">
						{ri.title && <h2 className="text-xl font-semibold mb-2">{ri.title}</h2>}
					</div>
					{pinConfig && isDraft && (
						<span className="flex-shrink-0 text-xs font-medium uppercase tracking-wide text-dusty-grey border border-dusty-grey rounded px-1.5 py-0.5">
							Draft
						</span>
					)}
					{canPin && (
						<button
							onClick={(e) => { e.stopPropagation(); handleTogglePin(); }}
							disabled={atPinLimit}
							title={atPinLimit ? `Max ${MAX_PINNED} posts pinned` : isPinned ? "Unpin" : "Pin to top of profile"}
							className={`flex-shrink-0 p-1 rounded transition-all ${
								isPinned
									? "opacity-100 text-rich-brown hover:text-warm-grey"
									: atPinLimit
									? "opacity-0 group-hover:opacity-100 text-gray-300 cursor-not-allowed"
									: "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rich-brown"
							}`}
						>
							<PinIcon className="w-4 h-4" pinned={isPinned} />
						</button>
					)}
				</div>
			</div>

			<p className="text-warm-grey text-sm mb-2">
				{truncate ? truncateText(ri.content, 250) : ri.content}
			</p>

			{ev && (
				<div className="mb-2 text-sm text-gray-600">
					<p className="font-medium flex items-center gap-2">
						📅 {formatDateTime(ev.eventDateTime)}
						{isPast && <span className="text-xs font-medium uppercase tracking-wide text-dusty-grey border border-dusty-grey rounded px-1.5 py-0.5">Past</span>}
					</p>
					<p className="text-xs">📍 {ev.location}</p>
				</div>
			)}

			{handle && (
				<div className="flex flex-row items-center gap-2 mb-2">
					<div className="flex items-center gap-1">
						<AtSignIcon className="w-3 h-3 text-gray-500" />
						<Link
							href={profileHref}
							onClick={(e) => e.stopPropagation()}
							className="text-sm text-rich-brown hover:underline"
						>
							{displayName}
						</Link>
					</div>
				</div>
			)}

			{(() => {
				const count = ri._count?.updates ?? 0;
				if (!count) return null;
				return (
					<div className="mt-2 mb-2" onClick={(e) => e.stopPropagation()}>
						<Link href={detailUrl} className="text-xs font-medium text-gray-500 hover:text-rich-brown hover:underline">
							{count} {count === 1 ? "update" : "updates"}
						</Link>
						{ri.recentUpdate && (
							<div className="mt-1 border-l-2 border-soft-grey pl-3">
								<p className="text-sm text-warm-grey whitespace-pre-wrap">
									{truncate ? truncateText(ri.recentUpdate.content, 120) : ri.recentUpdate.content}
								</p>
							</div>
						)}
					</div>
				);
			})()}

			{ri.images && ri.images.length > 0 && (
				<div className="mb-4" onClick={(e) => e.stopPropagation()}>
					<ImageCarousel images={ri.images} showCaptions={showCaptions} />
				</div>
			)}

			<Tags item={ri} />
		</div>
	);
}
