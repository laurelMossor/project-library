"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EventItem } from "@/lib/types/event";
import { CoverImageEditor } from "@/lib/components/event/CoverImageEditor";
import { InlineDateTimePicker } from "@/lib/components/event/InlineDateTimePicker";
import { EventPageShell, DraftBanner } from "@/lib/components/event/EventPageShell";
import { InlineEditableTitle } from "@/lib/components/inline-editable/InlineEditableTitle";
import { InlineEditableContent } from "@/lib/components/inline-editable/InlineEditableContent";
import { InlineEditableLocation } from "@/lib/components/inline-editable/InlineEditableLocation";
import { InlineEditableTags } from "@/lib/components/inline-editable/InlineEditableTags";
import { RsvpForm } from "@/lib/components/event/RsvpForm";
import { RsvpCounts } from "@/lib/components/event/RsvpCounts";
import { AttendeeList } from "@/lib/components/event/AttendeeList";
import { ShareButton } from "@/lib/components/ui/ShareButton";
import { DeleteEventButton } from "@/lib/components/event/DeleteEventButton";
import { PostsList } from "@/lib/components/post/PostsList";
import { updateEvent, publishEvent } from "@/lib/utils/event-client";
import { AuthError } from "@/lib/utils/auth-client";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { DropdownProfileSelector } from "@/lib/components/profile/DropdownProfileSelector";
import { MESSAGE_CONVERSATION, EXPLORE_PAGE, HOME, LOGIN_WITH_CALLBACK, EVENT_DETAIL } from "@/lib/const/routes";

type EventPageClientProps = {
	event: EventItem;
	isOwner: boolean;
	isLoggedIn: boolean;
};

/**
 * EventPageClient — view and edit surface for existing events.
 * Rendered by: src/app/events/[id]/page.tsx
 *
 * Field save behavior: each field calls the API immediately (PATCH per field)
 * on Save. The event already exists in the DB before the user sees this page.
 *
 * See CreateEventPage for the creation counterpart, which accumulates all
 * field edits in local state and writes to the DB only on Publish.
 */
export function EventPageClient({ event: initialEvent, isOwner, isLoggedIn }: EventPageClientProps) {
	const router = useRouter();
	const [event, setEvent] = useState(initialEvent);
	const [rsvpRefreshKey, setRsvpRefreshKey] = useState(0);
	const [publishing, setPublishing] = useState(false);
	const [publishError, setPublishError] = useState("");

	const isDraft = event.status === "DRAFT";
	const isPublished = event.status === "PUBLISHED";
	const page = event.page;
	const coverImageUrl = event.images?.[0]?.url || null;

	/** Redirect to login on auth failure, preserving the return URL. */
	const handleAuthError = () => {
		router.push(LOGIN_WITH_CALLBACK(EVENT_DETAIL(event.id)));
	};

	/**
	 * Wraps a field commit: applies the API response to event state, and
	 * redirects to login on AuthError instead of surfacing it as a field error.
	 */
	const commitField = async (fn: () => Promise<EventItem>) => {
		try {
			const updated = await fn();
			setEvent((prev) => ({ ...prev, ...updated }));
		} catch (err) {
			if (err instanceof AuthError) { handleAuthError(); return; }
			throw err; // re-throw so the field component shows the error
		}
	};

	const handlePublish = async () => {
		setPublishing(true);
		setPublishError("");
		try {
			const updated = await publishEvent(event.id);
			setEvent((prev) => ({ ...prev, ...updated }));
		} catch (err) {
			if (err instanceof AuthError) { handleAuthError(); return; }
			setPublishError(err instanceof Error ? err.message : "Failed to publish");
		} finally {
			setPublishing(false);
		}
	};

	const handleAuthorSwitch = async (pageId: string | null) => {
		try {
			const updated = await updateEvent(event.id, { pageId });
			setEvent((prev) => ({ ...prev, ...updated }));
		} catch (err) {
			if (err instanceof AuthError) handleAuthError();
		}
	};

	return (
		<EventPageShell
			header={
				<>
					{isDraft && isOwner && <DraftBanner />}
					<CoverImageEditor
						eventId={event.id}
						imageUrl={coverImageUrl}
						canEdit={isOwner}
						onImageUploaded={(url) => {
							setEvent((prev) => ({
								...prev,
								images: [{ id: "", url, path: "", altText: null, uploadedByUserId: "", createdAt: new Date() }, ...prev.images.slice(1)],
							}));
						}}
					/>
				</>
			}
		>
		<InlineEditableTitle
			value={event.title}
			canEdit={isOwner}
			placeholder="Event name"
			emptyLabel="Untitled Event"
			onCommit={(title) => commitField(() => updateEvent(event.id, { title }))}
		/>

			<InlineDateTimePicker
				eventDateTime={event.eventDateTime}
				canEdit={isOwner}
				onSave={(dateTime) => commitField(() => updateEvent(event.id, { eventDateTime: dateTime }))}
			/>

			{/* Organizer info + actions */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex-1">
					{isOwner && isDraft ? (
						<DropdownProfileSelector
							initialPageId={event.page?.id ?? null}
							onChange={handleAuthorSwitch}
						/>
					) : (
						<ProfileTag entity={page ?? event.user} size="md" asLink />
					)}
				</div>

				<div className="flex flex-wrap gap-3 items-center">
					{isPublished && <ShareButton />}
					{isLoggedIn && !isOwner && (
						<Link
							href={MESSAGE_CONVERSATION(event.userId)}
							className="px-3 py-1 text-sm font-medium border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
						>
							Message
						</Link>
					)}
					{isOwner && isDraft && (
						<button
							type="button"
							onClick={handlePublish}
							disabled={publishing || !event.title}
							className="px-5 py-2 text-sm font-semibold text-white bg-moss-green rounded-full hover:bg-rich-brown transition-colors disabled:opacity-50"
						>
							{publishing ? "Publishing..." : "Publish"}
						</button>
					)}
					{isOwner && isPublished && (
						<span className="px-3 py-1 text-xs font-semibold text-moss-green border border-melon-green rounded-full">
							Live
						</span>
					)}
				</div>
			</div>

			{publishError && <p className="text-sm text-alert-red">{publishError}</p>}

		<InlineEditableContent
			value={event.content}
			canEdit={isOwner}
			placeholder="What should people know?"
			onCommit={(content) => commitField(() => updateEvent(event.id, { content }))}
		/>

		<InlineEditableLocation
			value={event.location}
			latitude={event.latitude}
			longitude={event.longitude}
			mapTitle={event.title}
			canEdit={isOwner}
			onCommit={(location, latitude, longitude) =>
				commitField(() => updateEvent(event.id, { location, latitude, longitude }))
			}
		/>

			{isPublished && (
				<div className="space-y-4">
					<RsvpCounts eventId={event.id} refreshKey={rsvpRefreshKey} />
					<RsvpForm
						eventId={event.id}
						onRsvpSubmitted={() => setRsvpRefreshKey((k) => k + 1)}
					/>
				</div>
			)}

		<InlineEditableTags
			value={event.tags}
			canEdit={isOwner}
			onCommit={(tags) => commitField(() => updateEvent(event.id, { tags }))}
		/>

			<PostsList collectionId={event.id} collectionType="event" />

			{isOwner && isPublished && <AttendeeList eventId={event.id} />}

			<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-100">
				{isOwner && <DeleteEventButton eventId={event.id} eventTitle={event.title || "Untitled Event"} />}
				<Link
					href={EXPLORE_PAGE}
					className="text-sm font-medium text-gray-500 hover:text-rich-brown underline underline-offset-2"
				>
					Explore
				</Link>
				<Link
					href={HOME}
					className="text-sm font-medium text-gray-500 hover:text-rich-brown underline underline-offset-2"
				>
					Home
				</Link>
			</div>
		</EventPageShell>
	);
}
