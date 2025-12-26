import Link from "next/link";
import { CollectionItem, isEvent, getCollectionItemType } from "@/lib/types/collection";
import { ProfilePicPlaceholder } from "../user/ProfilePicPlaceholder";
import { Tag } from "../tag";
import { truncateText } from "@/lib/utils/text";
import { formatDateTime } from "@/lib/utils/datetime";
import { getCollectionItemUrl } from "@/lib/utils/collection";

type CollectionCardProps = {
	item: CollectionItem;
	truncate?: boolean;
};

export function CollectionCard({ item, truncate = false }: CollectionCardProps) {
	const isEventItem = isEvent(item);
	const itemType = getCollectionItemType(item);
	const detailUrl = getCollectionItemUrl(item);

	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			{/* Type badge and header */}
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					<ProfilePicPlaceholder owner={item.owner} />
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 uppercase">
								{itemType}
							</span>
						</div>
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

			{/* Event-specific info */}
			{isEventItem && (
				<div className="mb-2 text-sm text-gray-600">
					<p className="font-medium">📅 {formatDateTime(item.dateTime)}</p>
					<p className="text-xs">📍 {item.location}</p>
				</div>
			)}

			{/* Owner and date */}
			<div className="flex flex-row items-center gap-2 mb-2">
				<Link 
					href={`/u/${item.owner.username}`}
					className="text-sm text-rich-brown hover:underline"
				>
					{item.owner.name || item.owner.username}
				</Link>
				<p className="text-xs text-warm-grey">
					{isEventItem ? "Event" : formatDateTime(item.createdAt)}
				</p>
			</div>

			{/* Tags */}
			{item.tags && item.tags.length > 0 && (
				<div className="flex flex-wrap gap-2 mt-auto">
					{item.tags.map((tag) => (
						<Tag key={tag} tag={tag} />
					))}
				</div>
			)}
		</div>
	);
}

