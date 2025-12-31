/**
 * @deprecated This component has been replaced by CollectionCard.
 * Use CollectionCard from @/lib/components/collection/CollectionCard instead.
 * 
 * Migration: Replace <EventCard event={event} /> with <CollectionCard item={event} />
 * 
 * This component will be removed in a future version.
 */
import Link from "next/link";
import { ProfilePicPlaceholder } from "../user/ProfilePicPlaceholder";
import { EventItem } from "@/lib/types/event";
import { Tags } from "../tag";
import { truncateText } from "@/lib/utils/text";
import { formatDateTime } from "@/lib/utils/datetime";
import ImageCarousel from "../images/ImageCarousel";
import { EntriesList } from "../entry/EntriesList";

/** @deprecated Use CollectionCard instead */
export const EventCard = ({ event, truncate = false }: { event: EventItem, truncate?: boolean }) => {
	const detailUrl = `/events/${event.id}`;

	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			{/* Type badge and header */}
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					<ProfilePicPlaceholder owner={event.owner} />
					<div className="flex-1 min-w-0">
						<Link href={detailUrl}>
							<h2 className="text-xl font-semibold mb-2 hover:underline">{event.title}</h2>
						</Link>
					</div>
				</div>
			</div>

			{/* Description */}
			<p className="text-warm-grey text-sm mb-2">
				{truncate ? truncateText(event.description, 250) : event.description}
			</p>

			{/* Event-specific info */}
			<div className="mb-2 text-sm text-gray-600">
				<p className="font-medium">📅 {formatDateTime(event.dateTime)}</p>
				<p className="text-xs">📍 {event.location}</p>
			</div>

			{/* Owner and date */}
			<div className="flex flex-row items-center gap-2 mb-2">
				<Link 
					href={`/u/${event.owner.username}`}
					className="text-sm text-rich-brown hover:underline"
				>
					{event.owner.name || event.owner.username}
				</Link>
				<p className="text-xs text-warm-grey">
					Event
				</p>
			</div>

			{/* Images */}
			{event.images && event.images.length > 0 && (
				<div className="mb-4">
					<ImageCarousel images={event.images} />
				</div>
			)}

			<EntriesList 
				collectionId={event.id} 
				collectionType="event" 
				showTitle={true}
			/>

			<Tags item={event} />
		</div>
	);
};