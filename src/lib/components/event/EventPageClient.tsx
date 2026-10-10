"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { EventItem, EventUpdateData } from "@/lib/types/event";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { CoverImageEditor } from "@/lib/components/event/CoverImageEditor";
import { ImageEditModal } from "@/lib/components/images/ImageEditModal";
import { ImageLightbox } from "@/lib/components/images/ImageLightbox";
import { InlineDateTimePicker } from "@/lib/components/inline-editable/InlineDateTimePicker";
import { RsvpForm } from "@/lib/components/event/RsvpForm";
import { RsvpCounts } from "@/lib/components/event/RsvpCounts";
import { AttendeeList } from "@/lib/components/event/AttendeeList";
import { ShareButton } from "@/lib/components/ui/ShareButton";
import { DeleteConfirmButton } from "@/lib/components/ui/DeleteConfirmButton";
import { TagsField } from "@/lib/components/tag/TagsField";
import { EventMap } from "@/lib/components/map/EventMap";
import { PostsList } from "@/lib/components/post/PostsList";
import { LocationField } from "@/lib/components/map/LocationField";
import { deleteEventAction, updateEventAction } from "@/lib/actions/event";
import { useAction } from "@/lib/hooks/useAction";
import { validateEventPublishable } from "@/lib/validations";
import { uploadAndAttachImage } from "@/lib/utils/image-client";
import { eventHasContent } from "@/lib/utils/content";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { DropdownProfileSelector } from "@/lib/components/profile/DropdownProfileSelector";
import { PencilIcon } from "@/lib/components/icons/icons";
import { MESSAGE_CONVERSATION, EXPLORE_PAGE, PUBLIC_PROFILE } from "@/lib/const/routes";
import { contentIdentity } from "@/lib/utils/content-identity";
import { PostToSelector } from "@/lib/components/profile/PostToSelector";
import { getPersistedFilterUrl } from "@/lib/hooks/useFilterParams";
import { PostPageShell } from "@/lib/components/layout/PostPageShell";
import { Breadcrumb } from "@/lib/components/layout/Breadcrumb";
import { ContentCard } from "@/lib/components/layout/ContentCard";
import { PostContentArea } from "@/lib/components/layout/PostContentArea";
import { DashedPlaceholder } from "@/lib/components/ui/DashedPlaceholder";
import { LocalDate } from "@/lib/components/ui/LocalDate";
import { CommentSection } from "@/lib/components/comment/CommentSection";
import { useInlineEditSession, useOnEditingClosed } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import type { RsvpStatus, RsvpCountSummary, RsvpItem } from "@/lib/types/rsvp";
import type { CardUser } from "@/lib/types/card";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { CommentItem } from "@/lib/types/comment";

type EventPageClientProps = {
	event: EventItem;
	comments: CommentItem[];
	canEdit: boolean;
	canModerate: boolean;
	isLoggedIn: boolean;
	initialName?: string;
	initialEmail?: string;
	existingRsvpStatus?: RsvpStatus;
	initialGuestName?: string | null;
	initialHasPlusOne?: boolean;
	memberUser?: CardUser;
	/** Server-rendered RSVP data: null until the event is published. `rsvps` is the organizer's attendee list only. */
	rsvpCounts: RsvpCountSummary | null;
	rsvps: RsvpItem[] | null;
};

/**
 * Inner content — must be inside <InlineEditSession> to access editSession context.
 * `event` comes straight from the server render: every save is a Server Action that
 * refreshes the page, so this prop is always the current server state.
 */
function EventPageContent({
	event,
	canEdit,
	canModerate,
	isLoggedIn,
	initialName,
	initialEmail,
	existingRsvpStatus,
	initialGuestName,
	initialHasPlusOne,
	memberUser,
	rsvpCounts,
	rsvps,
}: Omit<EventPageClientProps, "comments">) {
	const router = useRouter();
	const editSession = useInlineEditSession();
	const { run: saveEvent } = useAction(updateEventAction);
	const { run: removeEvent } = useAction(deleteEventAction);
	const [editingField, setEditingField] = useState<string | null>(null);

	const isDraft = event.status === "DRAFT";
	const isPublished = event.status === "PUBLISHED";
	const [isEditing, setIsEditing] = useState(isDraft);
	const [coverModalOpen, setCoverModalOpen] = useState(false);
	const [coverLightboxOpen, setCoverLightboxOpen] = useState(false);
	const page = event.page;
	const coverImageUrl = event.images?.[0]?.url || null;

	// Cover upload is immediate (like avatars): attach on modal Save. replace:true swaps out
	// any existing cover in one call, and the attach action refreshes the banner from the server.
	async function handleCoverSave({ file }: { file: File | null }) {
		if (!file) return;
		await uploadAndAttachImage({ file, folder: "event-covers", type: "EVENT", targetId: event.id, replace: true });
	}

	// Session-backed fields — dirtyFields is the single source of truth.
	// displayContent renders these values so edited text is visible on blur.
	const { value: title, setValue: setTitle } = useInlineField("title", event.title);
	const { value: content, setValue: setContent } = useInlineField("content", event.content);
	const { value: tags, setValue: setTags } = useInlineField<string[]>("tags", event.tags);
	// Location fields are interdependent — all three update together on select
	const { value: locationDisplay, setValue: setLocationDisplay } = useInlineField<string | null>("location", event.location);
	const { value: latValue, setValue: setLat } = useInlineField<number | null>("latitude", event.latitude);
	const { value: lngValue, setValue: setLng } = useInlineField<number | null>("longitude", event.longitude);

	// Close any open field when editing ends (cancel reverts values automatically
	// because dirtyFields clears and useInlineField reads from it).
	useOnEditingClosed(() => setEditingField(null));

	// Drop out of edit mode when the event transitions to PUBLISHED
	useEffect(() => {
		if (event.status === "PUBLISHED") setIsEditing(false);
	}, [event.status]);

	// Tracks whether this event is still a draft so the unmount cleanup always
	// has the latest value (avoids stale closure over `isDraft`).
	const shouldDiscardOnLeaveRef = useRef(isDraft && canEdit);
	useEffect(() => {
		shouldDiscardOnLeaveRef.current = event.status === "DRAFT" && canEdit;
	}, [event.status, canEdit]);

	// True once any content has been added — prevents silent deletion of non-empty drafts.
	// eventHasContent counts a cover image (attached immediately now that the cover no
	// longer lives in the session as a pending file), so a cover-only draft survives.
	const coverCount = event.images?.length ?? 0;
	const hasContentRef = useRef(eventHasContent({ title: event.title, content: event.content, location: event.location, imageCount: coverCount }));
	useEffect(() => {
		if (eventHasContent({ title: event.title, content: event.content, location: event.location, imageCount: coverCount })) {
			hasContentRef.current = true;
		}
	}, [event.title, event.content, event.location, coverCount]);
	// Also count in-progress dirty scalar edits (title/content/etc.) not yet committed.
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
				// Fire-and-forget: the component is gone, so there's nothing to report to.
				void deleteEventAction({ id: eventId });
			}
		};
	// event.id is stable for the lifetime of this component
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const { voice, placedIn } = contentIdentity({
		user: event.user,
		page: event.page ?? null,
		asPageId: event.asPageId ?? null,
	});

	// Speaking as a page puts the event on that page. Speaking as yourself
	// starts on your profile; "Post to" can add a page after that.
	const handleAuthorSwitch = (asPageId: string | null) =>
		saveEvent({ id: event.id, data: asPageId ? { asPageId } : { asPageId: null, pageId: null, showOnAuthorProfile: false } });

	const handlePostTo = (next: { pageId: string | null; showOnAuthorProfile: boolean }) =>
		saveEvent({ id: event.id, data: { asPageId: null, ...next } });

	return (
		<>
			{/* Draft banner */}
			{isDraft && canEdit && (
				<div className="bg-alice-blue px-6 py-3 text-center text-sm font-medium text-whale-blue">
					Draft — only you can see this
				</div>
			)}

			{/* Cover image */}
			<CoverImageEditor
				imageUrl={coverImageUrl}
				canEdit={canEdit && isEditing}
				onEdit={() => setCoverModalOpen(true)}
				onOpen={coverImageUrl ? () => setCoverLightboxOpen(true) : undefined}
			/>
			{coverLightboxOpen && coverImageUrl && (
				<ImageLightbox src={coverImageUrl} alt="Event cover" onClose={() => setCoverLightboxOpen(false)} />
			)}
			{canEdit && coverModalOpen && (
				<ImageEditModal
					isOpen
					onClose={() => setCoverModalOpen(false)}
					title={coverImageUrl ? "Change cover" : "Add cover image"}
					previewShape="rect"
					existingImageUrl={coverImageUrl}
					onSave={handleCoverSave}
				/>
			)}

			<PostContentArea>
				{/* Title */}
				<InlineEditable
					canEdit={canEdit && isEditing}
					isEditing={editingField === "title"}
					onEditStart={() => setEditingField("title")}
					onCancel={() => setEditingField(null)}
					displayContent={
						<h1 className={`text-4xl leading-tight ${title ? "font-bold text-rich-brown" : "font-normal italic text-misty-forest/50"}`}>
							{(title as string) || (canEdit ? "Event name" : "Untitled Event")}
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
					canEdit={canEdit && isEditing}
				/>

				{/* Organizer info + actions */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex-1">
						{canEdit && isDraft ? (
							<div className="space-y-2">
								<DropdownProfileSelector
									label="Posting as"
									hint="Pages you can manage"
									initialPageId={event.asPageId ?? null}
									onChange={handleAuthorSwitch}
								/>
								{event.asPageId ? (
									<p className="text-xs text-dusty-grey">Posts as {event.page?.name ?? "this page"} go on its page.</p>
								) : (
									<PostToSelector
										pageId={event.pageId}
										showOnProfile={!event.pageId || event.showOnAuthorProfile}
										onChange={handlePostTo}
									/>
								)}
							</div>
						) : (
							<ProfileTag
								entity={voice}
								size="md"
								asLink
								trailing={placedIn ? (
									<Link href={PUBLIC_PROFILE(placedIn.handle)} className="text-dusty-grey font-normal">
										{" › "}{placedIn.name}
									</Link>
								) : undefined}
							/>
						)}
					</div>

					<div className="flex flex-wrap gap-3 items-center">
						{isPublished && <ShareButton />}
						{isLoggedIn && !canEdit && (
							<Link
								href={MESSAGE_CONVERSATION({ id: event.userId, type: "user" })}
								className="px-3 py-1 text-sm font-medium border border-soft-grey rounded-full hover:bg-grey-white transition-colors"
							>
								Message
							</Link>
						)}
						{canEdit && isPublished && (
							<span className="px-3 py-1 text-xs font-semibold text-moss-green border border-melon-green rounded-full">
								Live
							</span>
						)}
					</div>
				</div>

				{isPublished && (
					<LocalDate
						value={event.createdAt}
						mode="absolute"
						prefix="Posted "
						className="text-xs text-dusty-grey"
					/>
				)}

				{/* Description */}
				<InlineEditable
					canEdit={canEdit && isEditing}
					isEditing={editingField === "content"}
					onEditStart={() => setEditingField("content")}
					onCancel={() => setEditingField(null)}
					displayContent={(() => {
						const body = (
							<InlinePlaceholder value={content as string} placeholder="What should people know?">
								<p className="text-base leading-relaxed text-warm-grey whitespace-pre-wrap break-words">{content as string}</p>
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
					canEdit={canEdit && isEditing}
					isEditing={editingField === "location"}
					onEditStart={() => setEditingField("location")}
					onCancel={() => setEditingField(null)}
					displayContent={
						<div className="space-y-3">
							<div className="rounded-xl border border-soft-grey p-4">
								<p className="text-xs font-semibold uppercase tracking-wider text-misty-forest mb-1">Location</p>
								<InlinePlaceholder value={locationDisplay as string | null} placeholder={canEdit ? "Add a location" : "TBD"}>
									<p className="text-lg font-medium text-rich-brown">{locationDisplay as string}</p>
								</InlinePlaceholder>
							</div>
							{(latValue as number | null) != null && (lngValue as number | null) != null && (
								<EventMap latitude={(latValue as number)!} longitude={(lngValue as number)!} title={event.title || undefined} />
							)}
							{(latValue as number | null) == null && (lngValue as number | null) == null &&
								(locationDisplay as string | null) &&
								canEdit && (
								<p className="text-sm text-misty-forest">
									Add a map location by editing this event and picking a place from search.
								</p>
							)}
						</div>
					}
					editContent={
						<LocationField
							location={(locationDisplay as string | null) ?? ""}
							latitude={latValue as number | null}
							longitude={lngValue as number | null}
							onChange={({ location, latitude, longitude }) => {
								setLocationDisplay(location || null);
								setLat(latitude);
								setLng(longitude);
							}}
							autoFocus
							interactiveByDefault
						/>
					}
				/>

				{/* RSVP section (published events only) */}
				{isPublished && (
					<div className="space-y-4">
						{rsvpCounts && <RsvpCounts counts={rsvpCounts} />}
						<RsvpForm
							eventId={event.id}
							initialName={initialName}
							initialEmail={initialEmail}
							existingRsvpStatus={existingRsvpStatus}
							initialGuestName={initialGuestName}
							initialHasPlusOne={initialHasPlusOne}
							memberUser={memberUser}
						/>
					</div>
				)}

				{/* Tags */}
				<TagsField
					value={tags as string[]}
					onChange={(newTags) => setTags(newTags)}
					isOwner={canEdit}
					isEditing={isEditing}
					editingField={editingField}
					onEditStart={() => setEditingField("tags")}
					onCancel={() => setEditingField(null)}
				/>

				{/* Posts / updates */}
				<PostsList collectionId={event.id} collectionType="event" />

				{/* Attendee list (owner only) */}
				{rsvps && <AttendeeList rsvps={rsvps} />}

				{/* Footer actions */}
				{(canEdit || canModerate) && (
					<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-soft-grey">
						{canModerate && (
							<DeleteConfirmButton
								label="Delete Event"
								itemTitle={event.title || "Untitled Event"}
								onDelete={async () => {
									const result = await removeEvent({ id: event.id });
									if (result.ok) router.push(getPersistedFilterUrl(EXPLORE_PAGE, EXPLORE_PAGE));
									else if (result.error !== "unauthorized") throw new Error(result.message);
								}}
							/>
						)}
						{canEdit && isPublished && !isEditing && (
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="flex items-center gap-1.5 text-sm font-medium text-misty-forest hover:text-rich-brown transition-colors cursor-pointer"
							>
								<PencilIcon className="w-3.5 h-3.5" />
								Edit
							</button>
						)}
						{canEdit && isPublished && isEditing && (
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

export function EventPageClient({
	event,
	comments,
	canEdit,
	canModerate,
	isLoggedIn,
	initialName,
	initialEmail,
	existingRsvpStatus,
	initialGuestName,
	initialHasPlusOne,
	memberUser,
	rsvpCounts,
	rsvps,
}: EventPageClientProps) {
	const { run: saveEvent } = useAction(updateEventAction);
	const [exploreHref, setExploreHref] = useState(EXPLORE_PAGE);
	useEffect(() => { setExploreHref(getPersistedFilterUrl(EXPLORE_PAGE, EXPLORE_PAGE)); }, []);

	const isDraft = event.status === "DRAFT";
	const isPublished = event.status === "PUBLISHED";

	return (
		<PostPageShell breadcrumb={<Breadcrumb href={exploreHref} label="Back to Explore" />}>
			<ContentCard>
				<InlineEditSession
					resource={event as unknown as Record<string, unknown>}
					onSave={async ({ fields }: SavePayload) => {
						// The action refreshes the page, so the saved values arrive as new props.
						const result = await saveEvent({ id: event.id, data: fields as EventUpdateData });
						if (!result.ok) throw new Error(result.message);
					}}
					canEdit={canEdit}
					publishable={canEdit && isDraft}
					// The same rule the server enforces on publish, so the button never offers a publish it would refuse.
					canPublish={(current) => validateEventPublishable({
						title: (current.title as string) ?? "",
						content: (current.content as string) ?? "",
						eventDateTime: new Date(current.eventDateTime as string | Date),
						eventTimezone: (current.eventTimezone as string | null) ?? undefined,
						location: (current.location as string | null) ?? "",
						latitude: current.latitude as number | null,
						longitude: current.longitude as number | null,
						tags: current.tags as string[],
					}).valid}
					publishHint="Add a name, a description, and a future date to publish"
				>
					<EventPageContent
						event={event}
						canEdit={canEdit}
						canModerate={canModerate}
						isLoggedIn={isLoggedIn}
						initialName={initialName}
						initialEmail={initialEmail}
						existingRsvpStatus={existingRsvpStatus}
						initialGuestName={initialGuestName}
						initialHasPlusOne={initialHasPlusOne}
						memberUser={memberUser}
						rsvpCounts={rsvpCounts}
						rsvps={rsvps}
					/>
				</InlineEditSession>
			</ContentCard>

			{/* Comments live below the event, in their own card. Published events only. */}
			{isPublished && (
				<CommentSection
					target={{ kind: "event", id: event.id }}
					comments={comments}
					ownerUserId={event.userId}
					ownerPageId={event.pageId}
					isContentOwner={canModerate}
					isLoggedIn={isLoggedIn}
				/>
			)}
		</PostPageShell>
	);
}
