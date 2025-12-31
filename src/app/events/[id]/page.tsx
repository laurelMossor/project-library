import { getEventById } from "@/lib/utils/server/event";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EventMap } from "@/lib/components/map/EventMap";
import { Tags } from "@/lib/components/tag";
import { formatDateTime } from "@/lib/utils/datetime";
import { DeleteEventButton } from "@/lib/components/event/DeleteEventButton";
import { EntriesList } from "@/lib/components/entry/EntriesList";

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

	const isOwner = session?.user?.id === event.owner.id;

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 py-8 px-4">
			<div className="w-full max-w-5xl space-y-6 rounded border border-gray-200 bg-white p-6 shadow-sm">
				<div className="space-y-2">
					<p className="text-xs uppercase tracking-wider text-gray-500">Event</p>
					<h1 className="text-3xl font-bold">{event.title}</h1>
					<p className="text-sm text-gray-600">{formatDateTime(event.dateTime)}</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<Link
							href={`/u/${event.owner.username}`}
							className="text-base font-semibold text-black hover:underline"
						>
							{event.owner.name || event.owner.username}
						</Link>
						<p className="text-xs text-gray-500">@{event.owner.username}</p>
					</div>
					<div className="flex flex-wrap gap-3">
						{session && !isOwner && (
							<Link
								href={`/messages/${event.owner.id}`}
								className="rounded border border-black px-4 py-2 text-sm font-medium text-black transition hover:bg-black hover:text-white"
							>
								Message owner
							</Link>
						)}
						{isOwner && (
							<>
								<span className="rounded-full border border-emerald-400/70 px-3 py-1 text-xs font-semibold text-emerald-700">
									You own this event
								</span>
								<Link
									href={`/events/${id}/edit`}
									className="rounded border border-black px-4 py-2 text-sm font-medium text-black transition hover:bg-black hover:text-white"
								>
									Edit Event
								</Link>
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

				<EntriesList collectionId={id} collectionType="event" />

				<div className="flex flex-wrap gap-3 items-center">
					{isOwner && <DeleteEventButton eventId={id} eventTitle={event.title} />}
					<Link
						href="/collections"
						className="text-sm font-medium text-black underline underline-offset-2"
					>
						Back to collections
					</Link>
					<Link href="/" className="text-sm font-medium text-black underline underline-offset-2">
						Home
					</Link>
				</div>
			</div>
		</main>
	);
}

