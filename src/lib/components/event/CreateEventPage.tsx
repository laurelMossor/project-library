"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InlineDateTimePicker } from "@/lib/components/event/InlineDateTimePicker";
import { EventPageShell, DraftBanner } from "@/lib/components/event/EventPageShell";
import { InlineEditableTitle } from "@/lib/components/inline-editable/InlineEditableTitle";
import { InlineEditableContent } from "@/lib/components/inline-editable/InlineEditableContent";
import { InlineEditableLocation } from "@/lib/components/inline-editable/InlineEditableLocation";
import { InlineEditableTags } from "@/lib/components/inline-editable/InlineEditableTags";
import { DropdownProfileSelector } from "@/lib/components/profile/DropdownProfileSelector";
import { createEvent } from "@/lib/utils/event-client";
import { AuthError } from "@/lib/utils/auth-client";
import { EXPLORE_PAGE, HOME, LOGIN_WITH_CALLBACK, EVENT_DETAIL, EVENT_NEW } from "@/lib/const/routes";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";

function oneWeekFromNow() {
	return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * CreateEventPage — creation surface for new events.
 * Rendered by: src/app/events/new/page.tsx
 *
 * Field save behavior: each field commits to LOCAL React state only — no DB
 * writes occur until the user clicks Publish, at which point a single POST
 * creates the event as PUBLISHED and redirects to /events/[id].
 *
 * See EventPageClient for the editing counterpart, which writes each field to
 * the DB immediately via PATCH.
 */
export function CreateEventPage() {
	const router = useRouter();
	const { activePageId } = useActiveProfile();

	// Committed field values — sent to the API on Publish
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [eventDateTime, setEventDateTime] = useState<Date>(oneWeekFromNow);
	const [location, setLocation] = useState("");
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [tags, setTags] = useState<string[]>([]);
	const [pageId, setPageId] = useState<string | null>(activePageId ?? null);

	const [publishing, setPublishing] = useState(false);
	const [publishError, setPublishError] = useState("");

	const canPublish =
		title.trim() !== "" && content.trim() !== "" && eventDateTime > new Date();

	const handlePublish = async () => {
		setPublishing(true);
		setPublishError("");
		try {
			const event = await createEvent({
				title: title.trim(),
				content: content.trim(),
				eventDateTime,
				location: location.trim(),
				tags,
				...(pageId ? { pageId } : {}),
			});
			router.push(EVENT_DETAIL(event.id));
		} catch (err) {
			if (err instanceof AuthError) {
				router.push(LOGIN_WITH_CALLBACK(EVENT_NEW));
				return;
			}
			setPublishError(err instanceof Error ? err.message : "Failed to publish");
		} finally {
			setPublishing(false);
		}
	};

	return (
		<EventPageShell header={<DraftBanner />}>
		<InlineEditableTitle
			value={title}
			canEdit
			placeholder="Event name"
			emptyLabel="Untitled Event"
			onCommit={async (v) => setTitle(v)}
		/>

			<InlineDateTimePicker
				eventDateTime={eventDateTime}
				canEdit
				onSave={async (dateTime) => setEventDateTime(dateTime)}
			/>

			{/* Organizer + actions */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex-1">
					<DropdownProfileSelector
						initialPageId={pageId}
						onChange={(id) => setPageId(id)}
					/>
				</div>

				<div className="flex flex-wrap gap-3 items-center">
					<button
						type="button"
						onClick={handlePublish}
						disabled={publishing || !canPublish}
						className="px-5 py-2 text-sm font-semibold text-white bg-moss-green rounded-full hover:bg-rich-brown transition-colors disabled:opacity-50"
					>
						{publishing ? "Publishing..." : "Publish"}
					</button>
				</div>
			</div>

			{publishError && <p className="text-sm text-alert-red">{publishError}</p>}

		<InlineEditableContent
			value={content}
			canEdit
			placeholder="What should people know?"
			onCommit={async (v) => setContent(v)}
		/>

		<InlineEditableLocation
			value={location}
			latitude={latitude}
			longitude={longitude}
			mapTitle={title}
			canEdit
			onCommit={async (loc, lat, lng) => {
				setLocation(loc);
				setLatitude(lat);
				setLongitude(lng);
			}}
		/>

		<InlineEditableTags
			value={tags}
			canEdit
			onCommit={async (v) => setTags(v)}
		/>

			<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-100">
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
