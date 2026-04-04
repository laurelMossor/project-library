"use client";

/**
 * CollectionCard - Unified card component for all collection items
 *
 * This component handles rendering of events (and future collection types)
 * with a unified interface. It automatically detects the collection type and renders
 * appropriate fields.
 *
 * Usage:
 *   <CollectionCard item={collectionItem} truncate={true} />
 */
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CollectionItem, isEvent, isPost } from "@/lib/types/collection";
import { ProfilePicture } from "../profile/ProfilePicture";
import { Tags } from "../tag/Tag";
import { truncateText } from "@/lib/utils/text";
import { formatDateTime } from "@/lib/utils/datetime";
import ImageCarousel from "../images/ImageCarousel";
import { EVENT_DETAIL, POST_DETAIL, PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import { getCardUserDisplayName } from "@/lib/types/card";
import { AtSignIcon, PinIcon } from "../icons/icons";

const MAX_PINNED = 3;

/** Configuration for pin functionality — only provided on profile/page collection views */
export type PinConfig = {
	currentUserId: string;
	activePageId?: string | null;
	pinnedCount: number;
};

type CollectionCardProps = {
	item: CollectionItem;
	truncate?: boolean;
	showCaptions?: boolean;
	pinConfig?: PinConfig;
};

export function CollectionCard({ item, truncate = true, showCaptions = false, pinConfig }: CollectionCardProps) {
	const router = useRouter();
	const isEventItem = isEvent(item);
	const isPostItem = isPost(item);
	const detailUrl = isEventItem ? EVENT_DETAIL(item.id) : POST_DETAIL(item.id);

	// Use page info if available, otherwise user info
	const displayName = item.page ? item.page.name : getCardUserDisplayName(item.user);
	const handle = item.page ? item.page.slug : item.user.username;
	const profileHref = item.page ? PUBLIC_PAGE(item.page.slug) : PUBLIC_USER_PAGE(item.user.username);

	// Pin button logic — only for posts, only when pinConfig is provided
	const isPinned = isPostItem ? Boolean(item.pinnedAt) : false;
	const canPin = isPostItem && !!pinConfig && (
		pinConfig.currentUserId === item.userId ||
		(item.page !== null && item.page?.id === pinConfig.activePageId)
	);
	const atPinLimit = pinConfig ? pinConfig.pinnedCount >= MAX_PINNED && !isPinned : false;

	async function handleTogglePin() {
		if (!isPostItem || atPinLimit) return;
		try {
			const res = await fetch(`/api/posts/${item.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pinnedAt: isPinned ? null : new Date().toISOString() }),
			});
			if (res.ok) {
				router.refresh();
			}
		} catch {
			// silent fail — user can retry
		}
	}

	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			{/* Header: Profile pic + Title + Pin */}
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					<ProfilePicture entity={item.page ?? item.user} size="md" />
					<div className="flex-1 min-w-0">
						<Link href={detailUrl}>
							<h2 className="text-xl font-semibold mb-2 hover:underline">{item.title || "Untitled"}</h2>
						</Link>
					</div>
					{canPin && (
						<button
							onClick={handleTogglePin}
							disabled={atPinLimit}
							title={atPinLimit ? `Max ${MAX_PINNED} posts pinned` : isPinned ? "Unpin" : "Pin to top of profile"}
							className={`flex-shrink-0 p-1 rounded transition-colors ${
								isPinned
									? "text-rich-brown hover:text-warm-grey"
									: atPinLimit
									? "text-gray-300 cursor-not-allowed"
									: "text-gray-400 hover:text-rich-brown"
							}`}
						>
							<PinIcon className="w-4 h-4" pinned={isPinned} />
						</button>
					)}
				</div>
			</div>

			{/* Content */}
			<p className="text-warm-grey text-sm mb-2">
				{truncate ? truncateText(item.content, 250) : item.content}
			</p>

			{/* Event-specific info (only for events) */}
			{isEventItem && (
				<div className="mb-2 text-sm text-gray-600">
					<p className="font-medium">📅 {formatDateTime(item.eventDateTime)}</p>
					<p className="text-xs">📍 {item.location}</p>
				</div>
			)}

			{/* Creator and date */}
			{handle && (
				<div className="flex flex-row items-center gap-2 mb-2">
					<div className="flex items-center gap-1">
						<AtSignIcon className="w-3 h-3 text-gray-500" />
						<Link
							href={profileHref}
							className="text-sm text-rich-brown hover:underline"
						>
							{displayName}
						</Link>
					</div>
				</div>
			)}

			{/* Updates section, TODO: Create a component for this */}
			{(() => {
				const count = item._count?.updates ?? 0;
				if (!count || count === 0) return null;
				return (
					<div className="mt-2 mb-2">
						<Link href={detailUrl} className="text-xs font-medium text-gray-500 hover:text-rich-brown hover:underline">
							{count} {count === 1 ? "update" : "updates"}
						</Link>
						{item.recentUpdate && (
							<div className="mt-1 border-l-2 border-soft-grey pl-3">
								<p className="text-sm text-warm-grey whitespace-pre-wrap">
									{truncate ? truncateText(item.recentUpdate.content, 120) : item.recentUpdate.content}
								</p>
							</div>
						)}
					</div>
				);
			})()}

			{/* Images */}
			{item.images && item.images.length > 0 && (
				<div className="mb-4">
					<ImageCarousel images={item.images} showCaptions={showCaptions} />
				</div>
			)}

			{/* Tags */}
			<Tags item={item} />
		</div>
	);
}
