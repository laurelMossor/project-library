"use client";

import { useState } from "react";
import Link from "next/link";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { DeleteConfirmButton } from "@/lib/components/ui/DeleteConfirmButton";
import { formatRelativeTime } from "@/lib/utils/datetime";
import { resolveCardIdentity } from "@/lib/types/card";
import { commentIdentity, type CommentItem } from "@/lib/types/comment";

type CommentRowProps = {
	comment: CommentItem;
	/** The comment speaks as the post/event owner → show an "author" badge. */
	isFromOwner: boolean;
	/** Viewer is the comment author → may edit. */
	canEdit: boolean;
	/** Viewer is the comment author or the content owner → may delete. */
	canDelete: boolean;
	onEdit: (id: string, content: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
};

/**
 * One comment, read top-to-bottom as a single unit: authorship (name · author badge),
 * then the body, then a muted meta footer (time · edit · delete). Avatar anchors the left.
 * The author can edit inline, swapping the body for a textarea + save/cancel.
 */
export function CommentRow({ comment, isFromOwner, canEdit, canDelete, onEdit, onDelete }: CommentRowProps) {
	const entity = commentIdentity(comment);
	const { name, href } = resolveCardIdentity(entity);

	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(comment.content);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	function startEdit() {
		setDraft(comment.content);
		setError("");
		setEditing(true);
	}

	async function save() {
		const trimmed = draft.trim();
		if (!trimmed || saving) return;
		setSaving(true);
		setError("");
		try {
			await onEdit(comment.id, trimmed);
			setEditing(false);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to edit comment");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="flex gap-3">
			<ProfilePicture entity={entity} size="sm" asLink />
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<Link href={href} className="text-sm font-medium text-rich-brown hover:underline">
						{name}
					</Link>
					{isFromOwner && (
						<span className="rounded border border-soft-grey/60 px-1.5 py-0.5 text-[11px] font-medium text-dusty-grey">
							Author
						</span>
					)}
				</div>

				{editing ? (
					<div className="mt-1 space-y-2">
						<textarea
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							rows={3}
							maxLength={5000}
							autoFocus
							className="w-full rounded-lg border border-ash-green p-3 text-sm text-warm-grey focus:border-rich-brown focus:outline-none focus:ring-2 focus:ring-rich-brown/20"
						/>
						{error && <p className="text-sm text-novel-red">{error}</p>}
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={save}
								disabled={!draft.trim() || saving}
								className="rounded-full bg-moss-green px-4 py-1.5 text-sm font-medium text-grey-white transition-colors hover:bg-rich-brown disabled:cursor-not-allowed disabled:opacity-50"
							>
								{saving ? "Saving…" : "Save"}
							</button>
							<button
								type="button"
								onClick={() => setEditing(false)}
								className="text-xs font-medium text-dusty-grey transition-colors hover:text-rich-brown"
							>
								Cancel
							</button>
						</div>
					</div>
				) : (
					<>
						<p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-warm-grey">{comment.content}</p>
						<div className="mt-1.5 flex items-center gap-3 text-xs text-dusty-grey">
							<span>{formatRelativeTime(comment.createdAt)}</span>
							{canEdit && (
								<button
									type="button"
									onClick={startEdit}
									className="font-medium text-dusty-grey transition-colors hover:text-rich-brown"
								>
									Edit
								</button>
							)}
							{canDelete && (
								<DeleteConfirmButton label="Delete" variant="link" onDelete={() => onDelete(comment.id)} />
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
