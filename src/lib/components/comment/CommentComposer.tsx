"use client";

import { useEffect, useState } from "react";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { DropdownProfileSelector } from "@/lib/components/profile/DropdownProfileSelector";

type CommentComposerProps = {
	/** Add the comment. Resolves on success (clears the box); throws with a message on failure. */
	onSubmit: (content: string, asPageId: string | null) => Promise<void>;
};

/**
 * The comment compose box. Shows an identity picker only when the user manages ≥1 page
 * (so they can comment "as" a page); otherwise just their avatar.
 */
export function CommentComposer({ onSubmit }: CommentComposerProps) {
	const { currentUser, pages, fetchPages } = useActiveProfile();
	const [content, setContent] = useState("");
	const [asPageId, setAsPageId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	// Load the identities the user can comment as (drives whether the picker shows).
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => { fetchPages(); }, []);

	const trimmed = content.trim();
	const hasPages = pages.length > 0;

	async function handleSubmit() {
		if (!trimmed || submitting) return;
		setSubmitting(true);
		setError("");
		try {
			await onSubmit(trimmed, asPageId);
			setContent("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to add comment");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="flex gap-3">
			{!hasPages && currentUser && <ProfilePicture entity={currentUser} size="sm" />}
			<div className="flex-1 space-y-2">
				{hasPages && (
					<DropdownProfileSelector label="Commenting as" initialPageId={null} onChange={setAsPageId} />
				)}
				<textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Add a comment…"
					rows={3}
					maxLength={5000}
					className="w-full rounded-lg border border-ash-green p-3 text-sm text-warm-grey focus:border-rich-brown focus:outline-none focus:ring-2 focus:ring-rich-brown/20"
				/>
				{error && <p className="text-sm text-novel-red">{error}</p>}
				<div className="flex justify-end">
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!trimmed || submitting}
						className="rounded-full bg-moss-green px-4 py-1.5 text-sm font-medium text-grey-white transition-colors hover:bg-rich-brown disabled:cursor-not-allowed disabled:opacity-50"
					>
						{submitting ? "Posting…" : "Comment"}
					</button>
				</div>
			</div>
		</div>
	);
}
