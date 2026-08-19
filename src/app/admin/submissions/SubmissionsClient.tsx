"use client";

import { useCallback, useEffect, useState } from "react";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { Button } from "@/lib/components/ui/Button";
import { authFetch, AuthError } from "@/lib/utils/auth-client";
import { createEvent } from "@/lib/utils/event-client";
import { withDisclaimer, withSourceLine } from "@/lib/utils/text";
import { API_ADMIN_SUBMISSIONS, API_ADMIN_SUBMISSION, EVENT_DETAIL } from "@/lib/const/routes";

type SubmissionStatus = "PENDING" | "READY" | "NEEDS_FIX" | "FAILED" | "PUBLISHED" | "REJECTED";

// The shape returned by GET /api/admin/submissions (EventSubmission + rawImage url).
type Submission = {
	id: string;
	status: SubmissionStatus;
	submitterTelegramId: string;
	submittedAt: string;
	sourceUrl: string | null;
	rawCaption: string | null;
	rawImageId: string | null;
	rawImage: { url: string } | null;
	title: string | null;
	content: string | null;
	eventDate: string | null;
	eventTimezone: string | null;
	location: string | null;
	tags: string[];
	errorNote: string | null;
};

// Editable field state, seeded from the submission (source line pre-filled on hand-fill).
type Draft = {
	title: string;
	content: string;
	eventDate: string; // datetime-local value ("YYYY-MM-DDTHH:mm") or ""
	location: string;
	tags: string; // comma-separated
};

/** ISO → datetime-local input value in the browser's local time. */
function toLocalInput(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
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
		tags: s.tags.join(", "),
	};
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
	PENDING: "Extracting…",
	READY: "Ready",
	NEEDS_FIX: "Needs a date",
	FAILED: "Extraction failed",
	PUBLISHED: "Published",
	REJECTED: "Rejected",
};

export function SubmissionsClient({ eventsPageId }: { eventsPageId: string | null }) {
	const [items, setItems] = useState<Submission[]>([]);
	const [drafts, setDrafts] = useState<Record<string, Draft>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [busyId, setBusyId] = useState<string | null>(null);
	// Remember the Event a submission already created, so a retry after a transient publish
	// failure reuses it instead of materializing a duplicate.
	const [createdEventIds, setCreatedEventIds] = useState<Record<string, string>>({});

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const res = await authFetch(API_ADMIN_SUBMISSIONS);
			if (!res.ok) throw new Error("Failed to load submissions");
			const data: Submission[] = await res.json();
			setItems(data);
			setDrafts(Object.fromEntries(data.map((s) => [s.id, seedDraft(s)])));
		} catch (err) {
			setError(err instanceof AuthError ? "Your session expired — please log in again." : "Failed to load submissions.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const updateDraft = (id: string, patch: Partial<Draft>) =>
		setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

	const removeItem = (id: string) => setItems((prev) => prev.filter((s) => s.id !== id));

	const parseTags = (raw: string) =>
		raw
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);

	// Persist operator edits without materializing (recomputes READY/NEEDS_FIX from date).
	const saveEdits = async (id: string) => {
		const d = drafts[id];
		setBusyId(id);
		setError("");
		try {
			const res = await authFetch(API_ADMIN_SUBMISSION(id), {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "edit",
					fields: {
						title: d.title || null,
						content: d.content || null,
						eventDate: d.eventDate ? new Date(d.eventDate).toISOString() : null,
						location: d.location || null,
						tags: parseTags(d.tags),
					},
				}),
			});
			if (!res.ok) throw new Error("Save failed");
			const updated: Submission = await res.json();
			setItems((prev) => prev.map((s) => (s.id === id ? updated : s)));
		} catch {
			setError("Couldn't save edits.");
		} finally {
			setBusyId(null);
		}
	};

	const reject = async (id: string) => {
		setBusyId(id);
		setError("");
		try {
			const res = await authFetch(API_ADMIN_SUBMISSION(id), {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "reject" }),
			});
			if (!res.ok) throw new Error("Reject failed");
			removeItem(id);
		} catch {
			setError("Couldn't reject that submission.");
		} finally {
			setBusyId(null);
		}
	};

	// Materialize: create the Event (publish or draft), attach the poster, mark PUBLISHED.
	// Runs entirely in the operator's session through the app's normal write path.
	const approve = async (submission: Submission, asDraft: boolean) => {
		const d = drafts[submission.id];
		setError("");

		const future = d.eventDate ? new Date(d.eventDate) : null;
		if (!asDraft) {
			if (!d.title.trim() || !d.content.trim()) {
				setError("A title and description are required to publish.");
				return;
			}
			if (!future || Number.isNaN(future.getTime()) || future.getTime() <= Date.now()) {
				setError("A valid future date is required to publish.");
				return;
			}
		}

		setBusyId(submission.id);
		try {
			// Reuse an Event already created for this submission on a prior (failed) attempt.
			let eventId = createdEventIds[submission.id];
			if (!eventId) {
				const event = await createEvent({
					title: d.title.trim(),
					content: d.content.trim(),
					// Draft path tolerates a missing date (route fabricates one); publish requires `future`.
					eventDateTime: future ?? new Date(),
					eventTimezone: submission.eventTimezone,
					location: d.location.trim(),
					tags: parseTags(d.tags),
					pageId: eventsPageId,
					isDraft: asDraft,
				});
				eventId = event.id;
				setCreatedEventIds((prev) => ({ ...prev, [submission.id]: eventId }));
			}

			// The server attaches the captured poster and marks the submission PUBLISHED,
			// idempotently — so any superadmin can approve, not just the poster's author account.
			const res = await authFetch(API_ADMIN_SUBMISSION(submission.id), {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "publish", eventId }),
			});
			if (!res.ok) throw new Error("Publish bookkeeping failed");

			removeItem(submission.id);
			window.open(EVENT_DETAIL(eventId), "_blank");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create the event.");
		} finally {
			setBusyId(null);
		}
	};

	if (loading) return <p className="text-gray-500">Loading submissions…</p>;

	return (
		<div className="space-y-6">
			{error && <p className="text-alert-red">{error}</p>}
			{items.length === 0 && <p className="text-gray-500">No open submissions. Forward a poster to the bot to get started.</p>}

			{items.map((s) => {
				const d = drafts[s.id];
				if (!d) return null;
				const busy = busyId === s.id;
				return (
					<div key={s.id} className="border border-soft-grey rounded-lg p-4 space-y-4">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-rich-brown">{STATUS_LABEL[s.status]}</span>
							<span className="text-xs text-gray-500">{new Date(s.submittedAt).toLocaleString()}</span>
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
										<FormField label="Date & time" required>
											<FormInput
												type="datetime-local"
												value={d.eventDate}
												onChange={(e) => updateDraft(s.id, { eventDate: e.target.value })}
											/>
										</FormField>
									</div>
									<div className="flex-1">
										<FormField label="Location">
											<FormInput value={d.location} onChange={(e) => updateDraft(s.id, { location: e.target.value })} />
										</FormField>
									</div>
								</div>
								<FormField label="Tags" helpText="Comma-separated">
									<FormInput value={d.tags} onChange={(e) => updateDraft(s.id, { tags: e.target.value })} />
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
							<Button variant="tertiary" size="sm" disabled={busy} onClick={() => saveEdits(s.id)}>
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
