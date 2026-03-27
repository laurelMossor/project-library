"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EventItem } from "@/lib/types/event";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { CoverImageEditor } from "@/lib/components/event/CoverImageEditor";
import { InlineDateTimePicker } from "@/lib/components/event/InlineDateTimePicker";
import { RsvpForm } from "@/lib/components/event/RsvpForm";
import { RsvpCounts } from "@/lib/components/event/RsvpCounts";
import { AttendeeList } from "@/lib/components/event/AttendeeList";
import { ShareButton } from "@/lib/components/ui/ShareButton";
import { DeleteEventButton } from "@/lib/components/event/DeleteEventButton";
import { Tags } from "@/lib/components/tag/Tag";
import { EventMap } from "@/lib/components/map/EventMap";
import { PostsList } from "@/lib/components/post/PostsList";
import { InteractiveMap, geocodeAddress } from "@/lib/components/map/InteractiveMap";
import { updateEvent, publishEvent } from "@/lib/utils/event-client";
import { AuthError } from "@/lib/utils/auth-client";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { PUBLIC_PAGE, MESSAGE_CONVERSATION, EXPLORE_PAGE, HOME, LOGIN_WITH_CALLBACK, EVENT_DETAIL } from "@/lib/const/routes";

type EventPageClientProps = {
	event: EventItem;
	isOwner: boolean;
	isLoggedIn: boolean;
};

export function EventPageClient({ event: initialEvent, isOwner, isLoggedIn }: EventPageClientProps) {
	const router = useRouter();
	const [event, setEvent] = useState(initialEvent);
	const [editingField, setEditingField] = useState<string | null>(null);
	const [rsvpRefreshKey, setRsvpRefreshKey] = useState(0);
	const [publishing, setPublishing] = useState(false);

	// Inline edit state
	const [editTitle, setEditTitle] = useState(event.title);
	const [editContent, setEditContent] = useState(event.content);
	const [editLocation, setEditLocation] = useState(event.location);
	const [editLatitude, setEditLatitude] = useState<number | null>(event.latitude);
	const [editLongitude, setEditLongitude] = useState<number | null>(event.longitude);
	const [editTags, setEditTags] = useState(event.tags.join(", "));
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState("");
	const [geocoding, setGeocoding] = useState(false);

	const isDraft = event.status === "DRAFT";
	const isPublished = event.status === "PUBLISHED";

	const page = event.page;
	const coverImageUrl = event.images?.[0]?.url || null;

	const handleAuthError = () => {
		router.push(LOGIN_WITH_CALLBACK(EVENT_DETAIL(event.id)));
	};

	const saveField = async (field: string, data: Record<string, unknown>) => {
		setSaving(true);
		setSaveError("");
		try {
			const updated = await updateEvent(event.id, data as Parameters<typeof updateEvent>[1]);
			setEvent((prev) => ({ ...prev, ...updated }));
			setEditingField(null);
		} catch (err) {
			if (err instanceof AuthError) {
				handleAuthError();
				return;
			}
			setSaveError(err instanceof Error ? err.message : "Failed to save");
			throw err;
		} finally {
			setSaving(false);
		}
	};

	const handlePublish = async () => {
		setPublishing(true);
		try {
			const updated = await publishEvent(event.id);
			setEvent((prev) => ({ ...prev, ...updated }));
		} catch (err) {
			if (err instanceof AuthError) {
				handleAuthError();
				return;
			}
			setSaveError(err instanceof Error ? err.message : "Failed to publish");
		} finally {
			setPublishing(false);
		}
	};

	const handleGeocodeAddress = async () => {
		if (!editLocation.trim()) return;
		setGeocoding(true);
		try {
			const coords = await geocodeAddress(editLocation.trim());
			if (coords) {
				setEditLatitude(coords.lat);
				setEditLongitude(coords.lng);
			}
		} catch {
			// Geocoding is optional
		} finally {
			setGeocoding(false);
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 py-8 px-4">
			<div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-glow">
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
					canEdit={isOwner}
					onImageUploaded={(url) => {
						setEvent((prev) => ({
							...prev,
							images: [{ id: "", url, path: "", altText: null, uploadedByUserId: "", createdAt: new Date() }, ...prev.images.slice(1)],
						}));
					}}
				/>

				<div className="px-8 py-8 space-y-8">
					{/* Title */}
					<InlineEditable
						canEdit={isOwner}
						isEditing={editingField === "title"}
						onEditStart={() => {
							setEditTitle(event.title);
							setEditingField("title");
						}}
						onSave={async () => {
							await saveField("title", { title: (editTitle || "").trim() });
						}}
						onCancel={() => setEditingField(null)}
						saving={saving}
						error={editingField === "title" ? saveError : undefined}
						displayContent={
							<h1 className="text-4xl font-bold text-rich-brown leading-tight">
								{event.title || (isOwner ? "Event name" : "Untitled Event")}
							</h1>
						}
						editContent={
							<input
								type="text"
								value={editTitle || ""}
								onChange={(e) => setEditTitle(e.target.value)}
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
						canEdit={isOwner}
						onSave={async (dateTime) => {
							await saveField("eventDateTime", { eventDateTime: dateTime });
						}}
					/>

					{/* Organizer info + actions */}
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex-1">
							<ProfileTag entity={page ?? event.user} size="md" asLink />
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

					{/* Description */}
					<InlineEditable
						canEdit={isOwner}
						isEditing={editingField === "content"}
						onEditStart={() => {
							setEditContent(event.content);
							setEditingField("content");
						}}
						onSave={async () => {
							await saveField("content", { content: editContent.trim() });
						}}
						onCancel={() => setEditingField(null)}
						saving={saving}
						error={editingField === "content" ? saveError : undefined}
						displayContent={
							<p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap">
								{event.content || (isOwner ? "What should people know?" : "")}
							</p>
						}
						editContent={
							<textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								placeholder="What should people know?"
								rows={6}
								maxLength={5000}
								className="w-full text-base leading-relaxed text-gray-700 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
								autoFocus
							/>
						}
					/>

					{/* Location */}
					<InlineEditable
						canEdit={isOwner}
						isEditing={editingField === "location"}
						onEditStart={() => {
							setEditLocation(event.location);
							setEditLatitude(event.latitude);
							setEditLongitude(event.longitude);
							setEditingField("location");
						}}
						onSave={async () => {
							await saveField("location", {
								location: editLocation.trim(),
								latitude: editLatitude,
								longitude: editLongitude,
							});
						}}
						onCancel={() => setEditingField(null)}
						saving={saving}
						error={editingField === "location" ? saveError : undefined}
						displayContent={
							<div className="space-y-3">
								<div className="rounded-xl border border-gray-200 p-4">
									<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Location</p>
									<p className="text-lg font-medium text-rich-brown">
										{event.location || (isOwner ? "Add a location" : "TBD")}
									</p>
								</div>
								{event.latitude != null && event.longitude != null && (
									<EventMap latitude={event.latitude} longitude={event.longitude} title={event.title || undefined} />
								)}
							</div>
						}
						editContent={
							<div className="space-y-3">
								<div className="flex gap-2">
									<input
										type="text"
										value={editLocation}
										onChange={(e) => setEditLocation(e.target.value)}
										placeholder="123 Main St, City, Country"
										maxLength={255}
										className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
										autoFocus
									/>
									<button
										type="button"
										onClick={handleGeocodeAddress}
										disabled={geocoding || !editLocation.trim()}
										className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
									>
										{geocoding ? "Searching..." : "Find on Map"}
									</button>
								</div>
								<InteractiveMap
									latitude={editLatitude}
									longitude={editLongitude}
									onLocationChange={(lat, lng) => {
										setEditLatitude(lat);
										setEditLongitude(lng);
									}}
								/>
								{editLatitude != null && editLongitude != null && (
									<p className="text-xs text-gray-500">
										Coordinates: {editLatitude.toFixed(6)}, {editLongitude.toFixed(6)}
									</p>
								)}
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
							/>
						</div>
					)}

					{/* Tags */}
					{event.tags.length > 0 && (
						<InlineEditable
							canEdit={isOwner}
							isEditing={editingField === "tags"}
							onEditStart={() => {
								setEditTags(event.tags.join(", "));
								setEditingField("tags");
							}}
							onSave={async () => {
								const tags = editTags
									.split(",")
									.map((t) => t.trim())
									.filter(Boolean)
									.slice(0, 10);
								await saveField("tags", { tags });
							}}
							onCancel={() => setEditingField(null)}
							saving={saving}
							error={editingField === "tags" ? saveError : undefined}
							displayContent={<Tags item={event} />}
							editContent={
								<input
									type="text"
									value={editTags}
									onChange={(e) => setEditTags(e.target.value)}
									placeholder="Tag1, Tag2, Tag3"
									className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
									autoFocus
								/>
							}
						/>
					)}

					{/* Tags input for owner when no tags exist */}
					{isOwner && event.tags.length === 0 && (
						<InlineEditable
							canEdit={isOwner}
							isEditing={editingField === "tags"}
							onEditStart={() => {
								setEditTags("");
								setEditingField("tags");
							}}
							onSave={async () => {
								const tags = editTags
									.split(",")
									.map((t) => t.trim())
									.filter(Boolean)
									.slice(0, 10);
								await saveField("tags", { tags });
							}}
							onCancel={() => setEditingField(null)}
							saving={saving}
							error={editingField === "tags" ? saveError : undefined}
							displayContent={
								<p className="text-sm text-gray-400">Add tags</p>
							}
							editContent={
								<input
									type="text"
									value={editTags}
									onChange={(e) => setEditTags(e.target.value)}
									placeholder="Tag1, Tag2, Tag3"
									className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
									autoFocus
								/>
							}
						/>
					)}

					{/* Posts / updates */}
					<PostsList collectionId={event.id} collectionType="event" />

					{/* Attendee list (owner only) */}
					{isOwner && isPublished && <AttendeeList eventId={event.id} />}

					{/* Footer actions */}
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
				</div>
			</div>
		</main>
	);
}
