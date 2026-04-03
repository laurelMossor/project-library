/**
 * @deprecated This component has been replaced by CollectionCard.
 * Use CollectionCard from @/lib/components/collection/CollectionCard instead.
 *
 * Migration: Replace <EventCard event={event} /> with <CollectionCard item={event} />
 *
 * This component will be removed in a future version.
 */
import Link from "next/link";
import { ProfilePicture } from "../profile/ProfilePicture";
import { EventItem } from "@/lib/types/event";
import { Tags } from "../tag/Tag";
import { truncateText } from "@/lib/utils/text";
import { formatDateTime } from "@/lib/utils/datetime";
import ImageCarousel from "../images/ImageCarousel";
import { PostsList } from "../post/PostsList";
import { EVENT_DETAIL, PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import { getCardUserDisplayName } from "@/lib/types/card";
import { AtSignIcon } from "../icons/icons";

/** @deprecated Use CollectionCard instead */
export const EventCard = ({ event, truncate = false }: { event: EventItem, truncate?: boolean }) => {
	const detailUrl = EVENT_DETAIL(event.id);
	const displayName = event.page ? event.page.name : getCardUserDisplayName(event.user);
	const handle = event.page ? event.page.slug : event.user.username;
	const profileHref = event.page ? PUBLIC_PAGE(event.page.slug) : PUBLIC_USER_PAGE(event.user.username);

	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			{/* Type badge and header */}
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					<ProfilePicture entity={event.page ?? event.user} size="md" />
					<div className="flex-1 min-w-0">
						<Link href={detailUrl}>
							<h2 className="text-xl font-semibold mb-2 hover:underline">{event.title}</h2>
						</Link>
					</div>
				</div>
			</div>

			{/* Content */}
			<p className="text-warm-grey text-sm mb-2">
				{truncate ? truncateText(event.content, 250) : event.content}
			</p>

			{/* Event-specific info */}
			<div className="mb-2 text-sm text-gray-600">
				<p className="font-medium">📅 {formatDateTime(event.eventDateTime)}</p>
				<p className="text-xs">📍 {event.location}</p>
			</div>

			{/* Creator and date */}
			<div className="flex flex-row items-center gap-2 mb-2">
				{handle && (
					<div className="flex items-center gap-1">
						<AtSignIcon className="w-3 h-3 text-gray-500" />
						<Link
							href={profileHref}
							className="text-sm text-rich-brown hover:underline"
						>
							{displayName}
						</Link>
					</div>
				)}
			</div>

			{/* Images */}
			{event.images && event.images.length > 0 && (
				<div className="mb-4">
					<ImageCarousel images={event.images} />
				</div>
			)}

			<PostsList
				collectionId={event.id}
				collectionType="event"
				showTitle={true}
			/>

			<Tags item={event} />
		</div>
	);
};
