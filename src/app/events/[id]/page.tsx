import { getEventById } from "@/lib/utils/server/event";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EventMap } from "@/lib/components/map/EventMap";
import { Tags } from "@/lib/components/tag/Tag";
import { formatDateTime } from "@/lib/utils/datetime";
import { DeleteEventButton } from "@/lib/components/event/DeleteEventButton";
import { PostsList } from "@/lib/components/post/PostsList";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE, MESSAGE_CONVERSATION, EVENT_EDIT, COLLECTIONS, HOME } from "@/lib/const/routes";
import { getUserDisplayName } from "@/lib/types/user";
import { getCardUserInitials } from "@/lib/types/card";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: Props) {
	const { id } = await params;
	const event = await getEventById(id);
	const session = await auth();

	if (!event) {
		notFound();
	}

	// Extract user and page info directly from event
	const user = event.user;
	const page = event.page;
	const displayName = page ? page.name : getUserDisplayName(user);
	const handle = page ? page.slug : user.username;
	const profileHref = page ? PUBLIC_PAGE(page.slug) : PUBLIC_USER_PAGE(user.username);
	const isOwner = session?.user?.id === event.userId;
	const initials = page
		? page.name.substring(0, 2).toUpperCase()
		: getCardUserInitials(user);

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 py-8 px-4">
			<div className="w-full max-w-5xl space-y-6 rounded border border-gray-200 bg-white p-6 shadow-sm">
				<div className="space-y-2">
					<p className="text-xs uppercase tracking-wider text-gray-500">Event</p>
					<h1 className="text-3xl font-bold">{event.title}</h1>
					<p className="text-sm text-gray-600">{formatDateTime(event.eventDateTime)}</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<Link
							href={profileHref}
							className="w-12 h-12 rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
						>
							<span className="text-gray-600 font-medium text-sm">{initials}</span>
						</Link>
						<div>
							<Link
								href={profileHref}
								className="text-base font-semibold text-black hover:underline"
							>
								{displayName}
							</Link>
							<p className="text-xs text-gray-500">@{handle}</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-3">
						{/* Message button: use the userId for messaging */}
						{session && !isOwner && (
							<ButtonLink href={MESSAGE_CONVERSATION(event.userId)} size="sm">
								Message
							</ButtonLink>
						)}
						{isOwner && (
							<>
								<span className="rounded-full border border-emerald-400/70 px-3 py-1 text-xs font-semibold text-emerald-700">
									You own this event
								</span>
								<ButtonLink href={EVENT_EDIT(id)} size="sm" variant="secondary">
									Edit Event
								</ButtonLink>
							</>
						)}
					</div>
				</div>

				<div className="space-y-4">
					<p className="text-base leading-relaxed text-gray-700">{event.description}</p>
				</div>

				{event.images && event.images.length > 0 && (
					<div className="overflow-hidden rounded border border-gray-200">
						<img
							src={event.images[0].url}
							alt={event.images[0].altText || `Image for ${event.title}`}
							className="h-64 w-full object-cover"
						/>
					</div>
				)}

				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded border border-gray-200 p-4">
						<p className="text-sm font-semibold text-gray-500">Location</p>
						<p className="text-lg font-medium text-gray-900">{event.location}</p>
						<p className="text-xs text-gray-500">
							{event.latitude != null && event.longitude != null
								? `Coordinates: ${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`
								: "Coordinates not provided"}
						</p>
					</div>
					<div className="rounded border border-gray-200 p-4">
						<p className="text-sm font-semibold text-gray-500">Tags</p>
						<Tags item={event} />
					</div>
				</div>

				{event.latitude != null && event.longitude != null && (
					<EventMap latitude={event.latitude} longitude={event.longitude} title={event.title} />
				)}

				<PostsList collectionId={id} collectionType="event" />

				<div className="flex flex-wrap gap-3 items-center">
					{isOwner && <DeleteEventButton eventId={id} eventTitle={event.title} />}
					<Link
						href={COLLECTIONS}
						className="text-sm font-medium text-black underline underline-offset-2"
					>
						Back to collections
					</Link>
					<Link href={HOME} className="text-sm font-medium text-black underline underline-offset-2">
						Home
					</Link>
				</div>
			</div>
		</main>
	);
}
