/**
 * CollectionCard - Unified card component for all collection items
 * 
 * This component handles rendering of both projects and events (and future collection types)
 * with a unified interface. It automatically detects the collection type and renders
 * appropriate fields.
 * 
 * Usage:
 *   <CollectionCard item={collectionItem} truncate={true} />
 */
import Link from "next/link";
import { CollectionItem, isEvent } from "@/lib/types/collection";
import { OwnerAvatar } from "../user/OwnerAvatar";
import { Tags } from "../tag/Tag";
import { truncateText } from "@/lib/utils/text";
import { formatDateTime } from "@/lib/utils/datetime";
import ImageCarousel from "../images/ImageCarousel";
import { PostsList } from "../post/PostsList";
import { EVENT_DETAIL, PROJECT_DETAIL, PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "@/lib/const/routes";
import { getOwnerDisplayName, getOwnerHandle, isOrgOwner } from "@/lib/utils/owner";
import { AtSignIcon } from "../icons/icons";

type CollectionCardProps = {
	item: CollectionItem;
	truncate?: boolean;
};

export function CollectionCard({ item, truncate = true }: CollectionCardProps) {
	const isEventItem = isEvent(item);
	const detailUrl = isEventItem ? EVENT_DETAIL(item.id) : PROJECT_DETAIL(item.id);
	const displayDate = isEventItem ? item.eventDateTime : item.createdAt;
	
	// Extract owner info from Owner structure
	const ownerDisplayName = getOwnerDisplayName(item.owner);
	const ownerUsername = getOwnerHandle(item.owner);
	const isOrg = isOrgOwner(item.owner);

	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			{/* Header: Profile pic + Title */}
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					<OwnerAvatar owner={item.owner} size="md" />
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

			{/* Owner and date */}
			{ownerUsername && (
				<div className="flex flex-row items-center gap-2 mb-2">
					<div className="flex items-center gap-1">
						<AtSignIcon className="w-3 h-3 text-gray-500" />
						<Link 
							href={isOrg ? PUBLIC_ORG_PAGE(ownerUsername) : PUBLIC_USER_PAGE(ownerUsername)}
							className="text-sm text-rich-brown hover:underline"
						>
							{ownerDisplayName}
						</Link>
					</div>
				</div>
			)}

			{/* Images */}
			{item.images && item.images.length > 0 && (
				<div className="mb-4">
					<ImageCarousel images={item.images} />
				</div>
			)}

			{/* Posts */}
			<PostsList 
				collectionId={item.id} 
				collectionType={isEventItem ? "event" : "project"} 
				showTitle={true}
			/>

			{/* Tags */}
			<Tags item={item} />
		</div>
	);
}
