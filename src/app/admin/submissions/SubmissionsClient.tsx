"use client";

import { useEffect, useState } from "react";
import type { EventSubmissionStatus } from "@prisma/client";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { Button } from "@/lib/components/ui/Button";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { LocationField } from "@/lib/components/map/LocationField";
import { useActionThunk, type ActionThunk } from "@/lib/hooks/useAction";
import { createEventAction } from "@/lib/actions/event";
import { publishSubmissionAction, rejectSubmissionAction, saveSubmissionEditsAction } from "@/lib/actions/admin";
import { withDisclaimer, withSourceLine } from "@/lib/utils/text";
import { EVENT_DETAIL } from "@/lib/const/routes";
import type { ReviewSubmission as Submission } from "@/lib/types/event-submission";

// Editable field state, seeded from the submission (source line pre-filled on hand-fill).
type Draft = {
	title: string;
	content: string;
	eventDate: string; // datetime-local value ("YYYY-MM-DDTHH:mm") or ""
	location: string;
	latitude: number | null;
	longitude: number | null;
	tags: string[];
};

/** Date → datetime-local input value in the browser's local time. */
function toLocalInput(date: Date | null): string {
	if (!date) return "";
	const d = new Date(date);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function seedDraft(s: Submission): Draft {
	// Pre-fill disclaimer + source line when there's no extracted content (hand-fill case).
	const content = s.content ?? withSourceLine(withDisclaimer(""), s.sourceUrl);
	return {
		title: s.title ?? "",
		content,
		eventDate: toLocalInput(s.eventDate),
		location: s.location ?? "",
		latitude: s.latitude,
		longitude: s.longitude,
		tags: s.tags,
	};
}

const STATUS_LABEL: Record<EventSubmissionStatus, string> = {
	PENDING: "Extracting…",
	READY: "Ready",
	NEEDS_FIX: "Needs a date",
	FAILED: "Extraction failed",
	PUBLISHED: "Published",
	REJECTED: "Rejected",
};

/**
 * The open submissions come from the server page; each review action refreshes it, so an edited
 * row re-renders and a rejected or published row drops off. Local state is only the operator's
 * unsaved drafts (seeded from the submission on first edit) and which row is busy.
 */
export function SubmissionsClient({ submissions, eventsPageId }: { submissions: Submission[]; eventsPageId: string | null }) {
	const [drafts, setDrafts] = useState<Record<string, Draft>>({});
	const [localError, setLocalError] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	// Remember the Event a submission already created, so a retry after a transient publish
	// failure reuses it instead of materializing a duplicate.
	const [createdEventIds, setCreatedEventIds] = useState<Record<string, string>>({});
	const { run, error: actionError, clearError } = useActionThunk();
	const error = localError ?? actionError;
	// Dates are edited and shown in the browser's timezone, which the server render can't know,
	// so the rows render after mount (hydration would otherwise disagree on every date field).
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const draftFor = (s: Submission) => drafts[s.id] ?? seedDraft(s);

	const updateDraft = (id: string, patch: Partial<Draft>) => {
		const s = submissions.find((item) => item.id === id);
		if (!s) return;
		setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? seedDraft(s)), ...patch } }));
	};

	/** Run one row's review step, marking that row busy until it settles. */
	const perform = (id: string, thunk: ActionThunk) => {
		setLocalError(null);
		clearError();
		setBusyId(id);
		void run(thunk).finally(() => setBusyId(null));
	};

	// Persist operator edits without materializing (recomputes READY/NEEDS_FIX from date).
	const saveEdits = (submission: Submission) => {
		const d = draftFor(submission);
		perform(submission.id, () =>
			saveSubmissionEditsAction({
				id: submission.id,
				fields: {
					title: d.title || null,
					content: d.content || null,
					eventDate: d.eventDate ? new Date(d.eventDate).toISOString() : null,
					location: d.location || null,
					latitude: d.latitude,
					longitude: d.longitude,
					tags: d.tags,
				},
			}),
		);
	};

	const reject = (id: string) => perform(id, () => rejectSubmissionAction({ id }));

	// Materialize: create the Event (publish or draft), attach the poster, mark PUBLISHED.
	// Runs entirely in the operator's session through the app's normal write path.
	const approve = (submission: Submission, asDraft: boolean) => {
		const d = draftFor(submission);

		const future = d.eventDate ? new Date(d.eventDate) : null;
		if (!asDraft) {
			if (!d.title.trim() || !d.content.trim()) {
				setLocalError("A title and description are required to publish.");
				return;
			}
			if (!future || Number.isNaN(future.getTime()) || future.getTime() <= Date.now()) {
				setLocalError("A valid future date is required to publish.");
				return;
			}
		}

		perform(submission.id, async () => {
			// Reuse an Event already created for this submission on a prior (failed) attempt.
			let eventId = createdEventIds[submission.id];
			if (!eventId) {
				const created = await createEventAction({
					title: d.title.trim(),
					content: d.content.trim(),
					// Draft path tolerates a missing date (it fabricates one); publish requires `future`.
					eventDateTime: future ?? new Date(),
					eventTimezone: submission.eventTimezone,
					location: d.location.trim(),
					latitude: d.latitude,
					longitude: d.longitude,
					tags: d.tags,
					asPageId: eventsPageId,
					isDraft: asDraft,
				});
				if (!created.ok) return created;
				eventId = created.data;
				const createdId = eventId;
				setCreatedEventIds((prev) => ({ ...prev, [submission.id]: createdId }));
			}

			// The server attaches the captured poster and marks the submission PUBLISHED,
			// idempotently — so any superadmin can approve, not just the poster's author account.
			const published = await publishSubmissionAction({ id: submission.id, eventId });
			if (published.ok) window.open(EVENT_DETAIL(eventId), "_blank");
			return published;
		});
	};

	if (!mounted) return <p className="text-gray-500">Loading submissions…</p>;

	return (
		<div className="space-y-6">
			{error && <p className="text-alert-red">{error}</p>}
			{submissions.length === 0 && <p className="text-gray-500">No open submissions. Forward a poster to the bot to get started.</p>}

			{submissions.map((s) => {
				const d = draftFor(s);
				const busy = busyId === s.id;
				return (
					<div key={s.id} className="border border-soft-grey rounded-lg p-4 space-y-4">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-rich-brown">{STATUS_LABEL[s.status]}</span>
							<span className="text-xs text-gray-500">{s.submittedAt.toLocaleString()}</span>
						</div>

						{s.errorNote && (s.status === "NEEDS_FIX" || s.status === "FAILED") && (
							<p className="text-sm text-alert-red">{s.errorNote}</p>
						)}

						<div className="flex gap-4">
							{s.rawImage && (
								<div className="shrink-0">
									{/* Plain img (not next/image): admin-only tool, and it sidesteps the remote-domain
									    allowlist so a stored Supabase poster always renders. */}
									<img
										src={s.rawImage.url}
										alt="Captured poster"
										width={140}
										height={140}
										className="rounded object-cover"
									/>
								</div>
							)}
							<div className="flex-1 space-y-3">
								<FormField label="Title">
									<FormInput value={d.title} onChange={(e) => updateDraft(s.id, { title: e.target.value })} />
								</FormField>
								<FormField label="Description" helpText="The disclaimer and 'Original source' line publish exactly as shown.">
									<FormTextarea rows={5} value={d.content} onChange={(e) => updateDraft(s.id, { content: e.target.value })} />
								</FormField>
								<div className="flex gap-3">
									<div className="flex-1">
										<FormField
											label="Date & time"
											required
											helpText={s.eventTimezone ? `Times are in ${s.eventTimezone}` : "Times default to Pacific (America/Los_Angeles)"}
										>
											<FormInput
												type="datetime-local"
												value={d.eventDate}
												onChange={(e) => updateDraft(s.id, { eventDate: e.target.value })}
											/>
										</FormField>
									</div>
								</div>
								<FormField label="Location">
									<LocationField
										location={d.location}
										latitude={d.latitude}
										longitude={d.longitude}
										onChange={(next) => updateDraft(s.id, next)}
									/>
								</FormField>
								<FormField label="Tags">
									<TagInputField
										tags={d.tags}
										onTagsChange={(tags) => updateDraft(s.id, { tags })}
									/>
								</FormField>
							</div>
						</div>

						<div className="flex flex-wrap gap-3 items-center pt-2">
							<Button variant="primary" size="sm" loading={busy} onClick={() => approve(s, false)}>
								Approve &amp; publish
							</Button>
							<Button variant="secondary" size="sm" disabled={busy} onClick={() => approve(s, true)}>
								Save as draft
							</Button>
							<Button variant="tertiary" size="sm" disabled={busy} onClick={() => saveEdits(s)}>
								Save edits
							</Button>
							<Button variant="danger" size="sm" disabled={busy} onClick={() => reject(s.id)}>
								Reject
							</Button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
