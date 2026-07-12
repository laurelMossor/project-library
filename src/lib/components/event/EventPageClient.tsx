"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Tag } from "@/lib/components/tag/Tag";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { EventMap } from "@/lib/components/map/EventMap";
import { PostsList } from "@/lib/components/post/PostsList";
import { InteractiveMap } from "@/lib/components/map/InteractiveMap";
import { LocationSearchInput, type LocationResult } from "@/lib/components/map/LocationSearchInput";
import { updateEvent, deleteEvent } from "@/lib/utils/event-client";
import { AuthError, authFetch } from "@/lib/utils/auth-client";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { DropdownProfileSelector } from "@/lib/components/profile/DropdownProfileSelector";
import { PencilIcon } from "@/lib/components/icons/icons";
import { MESSAGE_CONVERSATION, EXPLORE_PAGE, LOGIN_WITH_CALLBACK, EVENT_DETAIL } from "@/lib/const/routes";
import { getPersistedFilterUrl } from "@/lib/hooks/useFilterParams";
import { PostPageShell } from "@/lib/components/layout/PostPageShell";
import { ContentCard } from "@/lib/components/layout/ContentCard";
import { PostContentArea } from "@/lib/components/layout/PostContentArea";
import { DashedPlaceholder } from "@/lib/components/ui/DashedPlaceholder";
import { CommentSection } from "@/lib/components/comment/CommentSection";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import type { RsvpStatus } from "@/lib/types/rsvp";
import type { SavePayload } from "@/lib/types/inline-edit";

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

	const isDraft = event.status === "DRAFT";
	const isPublished = event.status === "PUBLISHED";
	const [isEditing, setIsEditing] = useState(isDraft);
	const page = event.page;
	const coverImageUrl = event.images?.[0]?.url || null;

	// Session-backed fields — dirtyFields is the single source of truth.
	// displayContent renders these values so edited text is visible on blur.
	const { value: title, setValue: setTitle } = useInlineField("title", event.title);
	const { value: content, setValue: setContent } = useInlineField("content", event.content);
	const { value: tags, setValue: setTags } = useInlineField<string[]>("tags", event.tags);
	// Location fields are interdependent — all three update together on select
	const { value: locationDisplay, setValue: setLocationDisplay } = useInlineField<string | null>("location", event.location);
	const { value: latValue, setValue: setLat } = useInlineField<number | null>("latitude", event.latitude);
	const { value: lngValue, setValue: setLng } = useInlineField<number | null>("longitude", event.longitude);

	// When editSession cancels, close any open edit field (values revert automatically
	// because dirtyFields clears and useInlineField reads from it).
	const cancelRevision = editSession?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditingField(null);
	// cancelRevision is the only intended trigger
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	// Drop out of edit mode when the event transitions to PUBLISHED
	useEffect(() => {
		if (event.status === "PUBLISHED") setIsEditing(false);
	}, [event.status]);

	// Tracks whether this event is still a draft so the unmount cleanup always
	// has the latest value (avoids stale closure over `isDraft`).
	const shouldDiscardOnLeaveRef = useRef(isDraft && isOwner);
	useEffect(() => {
		shouldDiscardOnLeaveRef.current = event.status === "DRAFT" && isOwner;
	}, [event.status, isOwner]);

	// True once any content has been added — prevents silent deletion of non-empty drafts.
	const hasContentRef = useRef(Boolean(event.title || event.content || event.location || event.tags.length));
	useEffect(() => {
		if (event.title || event.content || event.location || event.tags.length) {
			hasContentRef.current = true;
		}
	}, [event.title, event.content, event.location, event.tags.length]);
	// changeCount (not just dirtyFields) so a pending cover file also counts as content —
	// otherwise a draft with only a cover gets silently deleted on navigate-away.
	const changeCount = editSession?.changeCount ?? 0;
	useEffect(() => {
		if (changeCount > 0) hasContentRef.current = true;
	}, [changeCount]);

	// When the owner navigates away from an unpublished EMPTY draft, delete it silently.
	useEffect(() => {
		const eventId = event.id;
		let armed = false;
		const armTimer = setTimeout(() => { armed = true; }, 0);
		return () => {
			clearTimeout(armTimer);
			if (armed && shouldDiscardOnLeaveRef.current && !hasContentRef.current) {
				// eslint-disable-next-line no-console
				console.log("deleting draft event on navigation away:", eventId);
				deleteEvent(eventId).catch(() => {});
			}
		};
	// event.id is stable for the lifetime of this component
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleAuthError = () => {
		router.push(LOGIN_WITH_CALLBACK(EVENT_DETAIL(event.id)));
	};

	const handleLocationSelect = useCallback((result: LocationResult) => {
		setLat(result.lat);
		setLng(result.lng);
		setLocationDisplay(result.displayName);
	}, [setLat, setLng, setLocationDisplay]);

	const handleAuthorSwitch = async (pageId: string | null) => {
		try {
			const updated = await updateEvent(event.id, { pageId });
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
				imageUrl={coverImageUrl}
				canEdit={isOwner && isEditing}
			/>

			<PostContentArea>
				{/* Title */}
				<InlineEditable
					canEdit={isOwner && isEditing}
					isEditing={editingField === "title"}
					onEditStart={() => setEditingField("title")}
					onCancel={() => setEditingField(null)}
					displayContent={
						<h1 className={`text-4xl leading-tight ${title ? "font-bold text-rich-brown" : "font-normal italic text-misty-forest/50"}`}>
							{(title as string) || (isOwner ? "Event name" : "Untitled Event")}
						</h1>
					}
					editContent={
						<input
							type="text"
							value={(title as string) || ""}
							onChange={(e) => setTitle(e.target.value)}
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

				{/* Date & time — batched into session via useInlineField */}
				<InlineDateTimePicker
					eventDateTime={event.eventDateTime}
					eventTimezone={event.eventTimezone}
					canEdit={isOwner && isEditing}
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
								className="px-3 py-1 text-sm font-medium border border-soft-grey rounded-full hover:bg-grey-white transition-colors"
							>
								Message
							</Link>
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
					onEditStart={() => setEditingField("content")}
					onCancel={() => setEditingField(null)}
					displayContent={(() => {
						const body = (
							<InlinePlaceholder value={content as string} placeholder="What should people know?">
								<p className="text-base leading-relaxed text-warm-grey whitespace-pre-wrap">{content as string}</p>
							</InlinePlaceholder>
						);
						return (content as string)
							? <div className="p-3 rounded-lg min-h-[10rem]">{body}</div>
							: <DashedPlaceholder className="p-3 min-h-[10rem]">{body}</DashedPlaceholder>;
					})()}
					editContent={
						<textarea
							value={(content as string) || ""}
							onChange={(e) => setContent(e.target.value)}
							placeholder="What should people know?"
							rows={6}
							maxLength={5000}
							className="w-full text-base leading-relaxed text-warm-grey border border-ash-green rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
							autoFocus
						/>
					}
				/>

				{/* Location */}
				<InlineEditable
					canEdit={isOwner && isEditing}
					isEditing={editingField === "location"}
					onEditStart={() => setEditingField("location")}
					onCancel={() => setEditingField(null)}
					displayContent={
						<div className="space-y-3">
							<div className="rounded-xl border border-soft-grey p-4">
								<p className="text-xs font-semibold uppercase tracking-wider text-misty-forest mb-1">Location</p>
								<InlinePlaceholder value={locationDisplay as string | null} placeholder={isOwner ? "Add a location" : "TBD"}>
									<p className="text-lg font-medium text-rich-brown">{locationDisplay as string}</p>
								</InlinePlaceholder>
							</div>
							{(latValue as number | null) != null && (lngValue as number | null) != null && (
								<EventMap latitude={(latValue as number)!} longitude={(lngValue as number)!} title={event.title || undefined} />
							)}
						</div>
					}
					editContent={
						<div className="space-y-3">
							<LocationSearchInput
								value={(locationDisplay as string | null) ?? ""}
								onChange={(v) => setLocationDisplay(v || null)}
								onSelect={handleLocationSelect}
								autoFocus
							/>
							<InteractiveMap
								latitude={latValue as number | null}
								longitude={lngValue as number | null}
								onLocationChange={(lat, lng) => {
									setLat(lat);
									setLng(lng);
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
					onEditStart={() => setEditingField("tags")}
					onCancel={() => setEditingField(null)}
					displayContent={
						(tags as string[]).length > 0
							? (
								<div className="flex flex-wrap gap-2">
									{(tags as string[]).map((tag) => (
										<Tag key={tag} tag={tag} />
									))}
								</div>
							)
							: <InlinePlaceholder value={null} placeholder="Add topics" />
					}
					editContent={
						<TagInputField
							tags={tags as string[]}
							onTagsChange={(newTags) => setTags(newTags)}
						/>
					}
				/>

				{/* Posts / updates */}
				<PostsList collectionId={event.id} collectionType="event" />

				{/* Attendee list (owner only) */}
				{isOwner && isPublished && <AttendeeList eventId={event.id} />}

				{/* Footer actions */}
				{isOwner && (
					<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-soft-grey">
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
								className="flex items-center gap-1.5 text-sm font-medium text-misty-forest hover:text-rich-brown transition-colors cursor-pointer"
							>
								<PencilIcon className="w-3.5 h-3.5" />
								Edit
							</button>
						)}
						{isPublished && isEditing && (
							<button
								type="button"
								onClick={async () => {
									// saveAll() early-returns when nothing is dirty, and it counts
									// pending cover files — so a cover-only edit still gets saved.
									await editSession?.saveAll();
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

	const isDraft = event.status === "DRAFT";

	// Upload a pending cover file and attach it as the event banner (replace=true).
	const handleCommitFiles = useCallback(async (files: Record<string, File>): Promise<Partial<EventItem> | void> => {
		const coverFile = files["cover"];
		if (!coverFile) return;

		const formData = new FormData();
		formData.append("file", coverFile);
		const uploadRes = await authFetch("/api/upload?folder=event-covers", {
			method: "POST",
			body: formData,
		});
		if (!uploadRes.ok) {
			const data = await uploadRes.json().catch(() => ({}));
			throw new Error(data.error || "Failed to upload cover image");
		}
		const uploadData = await uploadRes.json();

		const attachRes = await authFetch("/api/image-attachments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				imageId: uploadData.id,
				type: "EVENT",
				targetId: event.id,
				replace: true,
			}),
		});
		if (!attachRes.ok) {
			const data = await attachRes.json().catch(() => ({}));
			throw new Error(data.error || "Failed to attach cover image");
		}

		// Return a partial update so the event's images array reflects the new banner
		return {
			images: [{ id: uploadData.id, url: uploadData.url, path: "", altText: null, caption: null, uploadedByUserId: "", createdAt: new Date() }],
		};
	}, [event.id]);

	const isPublished = event.status === "PUBLISHED";

	return (
		<PostPageShell breadcrumb={
			<Link href={exploreHref} className="text-sm text-misty-forest hover:text-rich-brown hover:underline">
				&larr; Back to Explore
			</Link>
		}>
			<ContentCard>
				<InlineEditSession
					resource={event as unknown as Record<string, unknown>}
					onSave={async ({ fields }: SavePayload) => {
						const updated = await updateEvent(event.id, fields as Parameters<typeof updateEvent>[1]);
						setEvent((prev) => ({ ...prev, ...updated }));
						return updated as unknown as Record<string, unknown>;
					}}
					onSaved={(updated) => {
						setEvent((prev) => ({ ...prev, ...(updated as Partial<EventItem>) }));
					}}
					onCommitFiles={handleCommitFiles as (files: Record<string, File>) => Promise<Partial<Record<string, unknown>> | void>}
					canEdit={isOwner}
					publishable={isOwner && isDraft}
					canPublish={(current) => Boolean((current.title as string)?.trim())}
					publishHint="Add an event name to publish"
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
			</ContentCard>

			{/* Comments live below the event, in their own card. Published events only. */}
			{isPublished && (
				<CommentSection
					target={{ kind: "event", id: event.id }}
					ownerUserId={event.userId}
					ownerPageId={event.pageId}
					isContentOwner={isOwner}
					isLoggedIn={isLoggedIn}
				/>
			)}
		</PostPageShell>
	);
}
