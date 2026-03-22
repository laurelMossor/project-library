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
import Link from "next/link";
import { CollectionItem, isEvent, isPost } from "@/lib/types/collection";
import { EntityAvatar } from "../owner/EntityAvatar";
import { Tags } from "../tag/Tag";
import { truncateText } from "@/lib/utils/text";
import { formatDateTime } from "@/lib/utils/datetime";
import ImageCarousel from "../images/ImageCarousel";
import { PostsList } from "../post/PostsList";
import { EVENT_DETAIL, POST_DETAIL, PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import { getCardUserDisplayName } from "@/lib/types/card";
import { AtSignIcon } from "../icons/icons";

type CollectionCardProps = {
	item: CollectionItem;
	truncate?: boolean;
};

export function CollectionCard({ item, truncate = true }: CollectionCardProps) {
	const isEventItem = isEvent(item);
	const detailUrl = isEventItem ? EVENT_DETAIL(item.id) : POST_DETAIL(item.id);

	// Use page info if available, otherwise user info
	const displayName = item.page ? item.page.name : getCardUserDisplayName(item.user);
	const handle = item.page ? item.page.slug : item.user.username;
	const profileHref = item.page ? PUBLIC_PAGE(item.page.slug) : PUBLIC_USER_PAGE(item.user.username);

	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			{/* Header: Profile pic + Title */}
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					{item.page ? (
						<EntityAvatar page={item.page} size="md" />
					) : (
						<EntityAvatar user={item.user} size="md" />
					)}
					<div className="flex-1 min-w-0">
						<Link href={detailUrl}>
							<h2 className="text-xl font-semibold mb-2 hover:underline">{item.title}</h2>
						</Link>
					</div>
				</div>
			</div>

			{/* Description */}
			<p className="text-warm-grey text-sm mb-2">
				{truncate ? truncateText(item.description, 250) : item.description}
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

			{/* Images (only for events) */}
			{isEventItem && item.images && item.images.length > 0 && (
				<div className="mb-4">
					<ImageCarousel images={item.images} />
				</div>
			)}

			{/* Posts (only for events) */}
			{isEventItem && (
				<PostsList
					collectionId={item.id}
					collectionType="event"
					showTitle={true}
				/>
			)}

			{/* Tags */}
			<Tags item={item} />
		</div>
	);
}
