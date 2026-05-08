"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EventItem } from "@/lib/types/event";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { CoverImageEditor } from "@/lib/components/event/CoverImageEditor";
import { InlineDateTimePicker } from "@/lib/components/inline-editable/InlineDateTimePicker";
import { RsvpForm } from "@/lib/components/event/RsvpForm";
import { RsvpCounts } from "@/lib/components/event/RsvpCounts";
import { AttendeeList } from "@/lib/components/event/AttendeeList";
import { ShareButton } from "@/lib/components/ui/ShareButton";
import { DeleteConfirmButton } from "@/lib/components/ui/DeleteConfirmButton";
import { Tags } from "@/lib/components/tag/Tag";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { EventMap } from "@/lib/components/map/EventMap";
import { PostsList } from "@/lib/components/post/PostsList";
import { InteractiveMap } from "@/lib/components/map/InteractiveMap";
import { LocationSearchInput, type LocationResult } from "@/lib/components/map/LocationSearchInput";
import { updateEvent, publishEvent, deleteEvent } from "@/lib/utils/event-client";
import { AuthError } from "@/lib/utils/auth-client";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { DropdownProfileSelector } from "@/lib/components/profile/DropdownProfileSelector";
import { PencilIcon } from "@/lib/components/icons/icons";
import { MESSAGE_CONVERSATION, EXPLORE_PAGE, LOGIN_WITH_CALLBACK, EVENT_DETAIL } from "@/lib/const/routes";
import { getPersistedFilterUrl } from "@/lib/hooks/useFilterParams";
import { PostPageShell } from "@/lib/components/layout/PostPageShell";
import { PostContentArea } from "@/lib/components/layout/PostContentArea";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import type { RsvpStatus } from "@/lib/types/rsvp";

type EventPageClientProps = {
	event: EventItem;
	isOwner: boolean;
	isLoggedIn: boolean;
	initialName?: string;
	initialEmail?: string;
	existingRsvpStatus?: RsvpStatus;
};

/** Inner content — must be inside <InlineEditSession> to access editSession context */
function EventPageContent({
	event,
	setEvent,
	isOwner,
	isLoggedIn,
	initialName,
	initialEmail,
	existingRsvpStatus,
}: {
	event: EventItem;
	setEvent: React.Dispatch<React.SetStateAction<EventItem>>;
	isOwner: boolean;
	isLoggedIn: boolean;
	initialName?: string;
	initialEmail?: string;
	existingRsvpStatus?: RsvpStatus;
}) {
	const router = useRouter();
	const editSession = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);
	const [rsvpRefreshKey, setRsvpRefreshKey] = useState(0);
	const [publishing, setPublishing] = useState(false);

	// Per-field pending values
	const [editTitle, setEditTitle] = useState(event.title);
	const [editContent, setEditContent] = useState(event.content);
	const [editLocation, setEditLocation] = useState(event.location);
	const [editLatitude, setEditLatitude] = useState<number | null>(event.latitude);
	const [editLongitude, setEditLongitude] = useState<number | null>(event.longitude);
	const [editTagsArr, setEditTagsArr] = useState<string[]>(event.tags);
	const [isEditing, setIsEditing] = useState(event.status === "DRAFT");

	const isDraft = event.status === "DRAFT";
	const isPublished = event.status === "PUBLISHED";
	const page = event.page;
	const coverImageUrl = event.images?.[0]?.url || null;

	// When editSession cancels, revert all field states
	const cancelRevision = editSession?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditTitle(event.title);
		setEditContent(event.content);
		setEditLocation(event.location);
		setEditLatitude(event.latitude);
		setEditLongitude(event.longitude);
		setEditTagsArr(event.tags);
		setEditingField(null);
	// cancelRevision changing is the only trigger we care about
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);


	// Tracks whether this event is still a draft so the unmount cleanup always
	// has the latest value (avoids stale closure over `isDraft`).
	const shouldDiscardOnLeaveRef = useRef(isDraft && isOwner);
	useEffect(() => {
		shouldDiscardOnLeaveRef.current = event.status === "DRAFT" && isOwner;
	}, [event.status, isOwner]);

	// When the owner navigates away from an unpublished draft, delete it silently.
	useEffect(() => {
		const eventId = event.id;
		let armed = false;
		const armTimer = setTimeout(() => { armed = true; }, 0);

		return () => {
			clearTimeout(armTimer);
			if (armed && shouldDiscardOnLeaveRef.current) {
				// eslint-disable-next-line no-console
				console.log("TODO: show discard-draft popup — deleting draft event on navigation away:", eventId);
				deleteEvent(eventId).catch(() => {});
			}
		};
	// event.id is stable for the lifetime of this component
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleAuthError = () => {
		router.push(LOGIN_WITH_CALLBACK(EVENT_DETAIL(event.id)));
	};

	const handlePublish = async () => {
		setPublishing(true);
		try {
			const dirtyCount = editSession ? Object.keys(editSession.dirtyFields).length : 0;
			if (dirtyCount > 0) await editSession?.saveAll();
			const updated = await publishEvent(event.id);
			setEvent((prev) => ({ ...prev, ...updated }));
			setIsEditing(false);
		} catch (err) {
			if (err instanceof AuthError) {
				handleAuthError();
				return;
			}
		} finally {
			setPublishing(false);
		}
	};

	const handleLocationSelect = useCallback((result: LocationResult) => {
		setEditLatitude(result.lat);
		setEditLongitude(result.lng);
		setEditLocation(result.displayName);
		editSession?.setDirty("latitude", result.lat, event.latitude);
		editSession?.setDirty("longitude", result.lng, event.longitude);
		editSession?.setDirty("location", result.displayName, event.location);
	}, [editSession, event.latitude, event.longitude, event.location]);

	const handleAuthorSwitch = async (pageId: string | null) => {
		try {
			const updated = await updateEvent(event.id, { pageId });
			setEvent((prev) => ({ ...prev, ...updated }));
		} catch (err) {
			if (err instanceof AuthError) handleAuthError();
		}
	};

	// InlineDateTimePicker saves its own field (date change is deliberate & isolated)
	const handleDateSave = async (dateTime: Date) => {
		try {
			const updated = await updateEvent(event.id, { eventDateTime: dateTime });
			setEvent((prev) => ({ ...prev, ...updated }));
		} catch (err) {
			if (err instanceof AuthError) handleAuthError();
		}
	};

	return (
		<>
			{/* Draft banner */}
			{isDraft && isOwner && (
				<div className="bg-alice-blue px-6 py-3 text-center text-sm font-medium text-whale-blue">
					Draft — only you can see this
				</div>
			)}

			{/* Cover image */}
			<CoverImageEditor
				eventId={event.id}
				imageUrl={coverImageUrl}
				canEdit={isOwner && isEditing}
				onImageUploaded={(url) => {
					setEvent((prev) => ({
						...prev,
						images: [{ id: "", url, path: "", altText: null, caption: null, uploadedByUserId: "", createdAt: new Date() }, ...prev.images.slice(1)],
					}));
				}}
			/>

			<PostContentArea>
				{/* Title */}
				<InlineEditable
					canEdit={isOwner && isEditing}
					isEditing={editingField === "title"}
					onEditStart={() => {
						setEditTitle(event.title);
						setEditingField("title");
					}}
			onCancel={() => setEditingField(null)}
			displayContent={
				<h1 className={`text-4xl leading-tight ${editTitle ? "font-bold text-rich-brown" : "font-normal italic text-misty-forest/50"}`}>
						{editTitle || (isOwner ? "Event name" : "Untitled Event")}
					</h1>
				}
				editContent={
					<input
						type="text"
						value={editTitle || ""}
					onChange={(e) => { setEditTitle(e.target.value); editSession?.setDirty("title", e.target.value, event.title); }}
					onBlur={() => setEditingField(null)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							setEditingField(null);
							editSession?.saveAll();
						}
					}}
					placeholder="Event name"
						className="w-full text-4xl font-bold text-rich-brown border-b-2 border-rich-brown/20 pb-1 focus:outline-none focus:border-rich-brown bg-transparent"
						maxLength={150}
						autoFocus
					/>
				}
				/>

				{/* Date & time */}
				<InlineDateTimePicker
					eventId={event.id}
					eventDateTime={event.eventDateTime}
					canEdit={isOwner && isEditing}
					onSave={handleDateSave}
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
								href={MESSAGE_CONVERSATION({ id: event.userId, type: "user" })}
								className="px-3 py-1 text-sm font-medium border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
							>
								Message
							</Link>
						)}
						{isOwner && isDraft && (
							<div className="flex flex-col items-start gap-1">
								<button
									type="button"
									onClick={handlePublish}
									disabled={publishing || !editTitle}
									className="px-5 py-2 text-sm font-semibold text-white bg-moss-green rounded-full hover:bg-rich-brown transition-colors disabled:opacity-50"
								>
									{publishing ? "Publishing..." : "Publish"}
								</button>
								{!editTitle && !publishing && (
									<p className="text-xs text-dusty-grey">Add an event name to publish</p>
								)}
							</div>
						)}
						{isOwner && isPublished && (
							<span className="px-3 py-1 text-xs font-semibold text-moss-green border border-melon-green rounded-full">
								Live
							</span>
						)}
					</div>
				</div>

				{/* Description */}
				<InlineEditable
					canEdit={isOwner && isEditing}
					isEditing={editingField === "content"}
					onEditStart={() => {
						setEditContent(event.content);
						setEditingField("content");
					}}
				onCancel={() => setEditingField(null)}
				displayContent={
					<div className={`p-3 rounded-lg min-h-[10rem] ${!event.content ? "bg-melon-green/10 border border-dashed border-ash-green/60" : ""}`}>
							<InlinePlaceholder value={event.content} placeholder="What should people know?">
								<p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap">{event.content}</p>
							</InlinePlaceholder>
						</div>
					}
					editContent={
						<textarea
							value={editContent}
						onChange={(e) => { setEditContent(e.target.value); editSession?.setDirty("content", e.target.value, event.content); }}
						placeholder="What should people know?"
							rows={6}
							maxLength={5000}
							className="w-full text-base leading-relaxed text-gray-700 border border-ash-green rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
							autoFocus
						/>
					}
				/>

				{/* Location */}
				<InlineEditable
					canEdit={isOwner && isEditing}
					isEditing={editingField === "location"}
					onEditStart={() => {
						if (!editSession?.dirtyFields["location"]) {
							setEditLocation(event.location);
							setEditLatitude(event.latitude);
							setEditLongitude(event.longitude);
						}
						setEditingField("location");
					}}
				onCancel={() => setEditingField(null)}
				displayContent={
					<div className="space-y-3">
						<div className="rounded-xl border border-gray-200 p-4">
							<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Location</p>
								<InlinePlaceholder value={editLocation ?? event.location} placeholder={isOwner ? "Add a location" : "TBD"}>
									<p className="text-lg font-medium text-rich-brown">{editLocation ?? event.location}</p>
								</InlinePlaceholder>
							</div>
							{(editLatitude ?? event.latitude) != null && (editLongitude ?? event.longitude) != null && (
								<EventMap latitude={(editLatitude ?? event.latitude)!} longitude={(editLongitude ?? event.longitude)!} title={event.title || undefined} />
							)}
						</div>
					}
					editContent={
						<div className="space-y-3">
							<LocationSearchInput
								value={editLocation}
								onChange={(v) => { setEditLocation(v); editSession?.setDirty("location", v, event.location); }}
								onSelect={handleLocationSelect}
								autoFocus
							/>
							<InteractiveMap
								latitude={editLatitude}
								longitude={editLongitude}
								onLocationChange={(lat, lng) => {
									setEditLatitude(lat);
									setEditLongitude(lng);
									editSession?.setDirty("latitude", lat, event.latitude);
									editSession?.setDirty("longitude", lng, event.longitude);
								}}
							/>
						</div>
					}
				/>

				{/* RSVP section (published events only) */}
				{isPublished && (
					<div className="space-y-4">
						<RsvpCounts eventId={event.id} refreshKey={rsvpRefreshKey} />
						<RsvpForm
							eventId={event.id}
							onRsvpSubmitted={() => setRsvpRefreshKey((k) => k + 1)}
							initialName={initialName}
							initialEmail={initialEmail}
							existingRsvpStatus={existingRsvpStatus}
						/>
					</div>
				)}

				{/* Tags */}
				<InlineEditable
					canEdit={isOwner && isEditing}
					isEditing={editingField === "tags"}
					onEditStart={() => {
						setEditTagsArr(event.tags);
						setEditingField("tags");
					}}
				onCancel={() => setEditingField(null)}
				displayContent={
					event.tags.length > 0
						? <Tags item={event} />
							: <InlinePlaceholder value={null} placeholder="Add topics" />
					}
					editContent={
						<TagInputField
							tags={editTagsArr}
							onTagsChange={(tags) => { setEditTagsArr(tags); editSession?.setDirty("tags", tags, event.tags); }}
						/>
					}
				/>

				{/* Posts / updates */}
				<PostsList collectionId={event.id} collectionType="event" />

				{/* Attendee list (owner only) */}
				{isOwner && isPublished && <AttendeeList eventId={event.id} />}

				{/* Footer actions */}
				{isOwner && (
					<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-100">
						<DeleteConfirmButton
							label="Delete Event"
							itemTitle={event.title || "Untitled Event"}
							onDelete={async () => {
								try {
									await deleteEvent(event.id);
									router.push(getPersistedFilterUrl(EXPLORE_PAGE, EXPLORE_PAGE));
								} catch (err) {
									if (err instanceof AuthError) { router.push(LOGIN_WITH_CALLBACK(EVENT_DETAIL(event.id))); return; }
									throw err;
								}
							}}
						/>
						{isPublished && !isEditing && (
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-rich-brown transition-colors cursor-pointer"
							>
								<PencilIcon className="w-3.5 h-3.5" />
								Edit
							</button>
						)}
						{isPublished && isEditing && (
							<button
								type="button"
								onClick={async () => {
									const dirtyCount = editSession ? Object.keys(editSession.dirtyFields).length : 0;
									if (dirtyCount > 0) await editSession?.saveAll();
									setIsEditing(false);
								}}
								className="text-sm font-medium text-moss-green hover:text-rich-brown transition-colors cursor-pointer"
							>
								Done
							</button>
						)}
					</div>
				)}
			</PostContentArea>
		</>
	);
}

export function EventPageClient({ event: initialEvent, isOwner, isLoggedIn, initialName, initialEmail, existingRsvpStatus }: EventPageClientProps) {
	const [event, setEvent] = useState(initialEvent);
	const [exploreHref, setExploreHref] = useState(EXPLORE_PAGE);
	useEffect(() => { setExploreHref(getPersistedFilterUrl(EXPLORE_PAGE, EXPLORE_PAGE)); }, []);

	return (
		<PostPageShell breadcrumb={
			<Link href={exploreHref} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
				&larr; Back to Explore
			</Link>
		}>
			<InlineEditSession
				resource={event as unknown as Record<string, unknown>}
				onSave={async ({ fields }) => {
					const updated = await updateEvent(event.id, fields as Parameters<typeof updateEvent>[1]);
					setEvent((prev) => ({ ...prev, ...updated }));
					return updated as unknown as Record<string, unknown>;
				}}
				onSaved={(updated) => {
					setEvent((prev) => ({ ...prev, ...(updated as Partial<EventItem>) }));
				}}
				canEdit={isOwner}
			>
				<EventPageContent
					event={event}
					setEvent={setEvent}
					isOwner={isOwner}
					isLoggedIn={isLoggedIn}
					initialName={initialName}
					initialEmail={initialEmail}
					existingRsvpStatus={existingRsvpStatus}
				/>
			</InlineEditSession>
		</PostPageShell>
	);
}
