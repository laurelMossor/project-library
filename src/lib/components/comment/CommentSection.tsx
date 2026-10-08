"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ContentCard } from "@/lib/components/layout/ContentCard";
import { DashedPlaceholder } from "@/lib/components/ui/DashedPlaceholder";
import { MessageIcon } from "@/lib/components/icons/icons";
import { CommentComposer } from "./CommentComposer";
import { CommentRow } from "./CommentRow";
import { getComments, createComment, updateComment, deleteComment, type CommentTarget } from "@/lib/utils/comment-client";
import { POST_DETAIL, EVENT_DETAIL, LOGIN_WITH_CALLBACK, COMMENT_ANCHOR, COMMENT_PARAM } from "@/lib/const/routes";
import type { CommentItem } from "@/lib/types/comment";

type CommentSectionProps = {
	target: CommentTarget;
	ownerUserId: string;
	ownerPageId: string | null;
	/** The viewer owns this post/event (author or page manager) — may delete any comment. */
	isContentOwner: boolean;
	isLoggedIn: boolean;
};

/**
 * Does a comment speak as the content's *display* identity (author / host)? For a page-owned
 * post/event the display owner is the page, so only a comment made as that page earns the badge;
 * for a user-owned one, the owning user commenting as themselves (not as some page).
 */
function isFromOwner(comment: CommentItem, ownerUserId: string, ownerPageId: string | null): boolean {
	return ownerPageId
		? comment.asPageId === ownerPageId
		: !comment.asPageId && comment.authorId === ownerUserId;
}

/**
 * The "Comments" card that sits below a post/event. Reads comments on mount, hosts the
 * composer (or a log-in prompt), and lists comments oldest-first, so the thread reads top to bottom. Comments inherit the
 * parent's viewability — the API gates that; this only renders what it's given.
 */
export function CommentSection({ target, ownerUserId, ownerPageId, isContentOwner, isLoggedIn }: CommentSectionProps) {
	const { currentUser } = useActiveProfile();
	const [comments, setComments] = useState<CommentItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	// A notification links to `?comment=<id>`. Clicking one while already on this page only changes the
	// param, so it re-reads the list too — the comment it points at may be newer than what's shown.
	const focusId = useSearchParams().get(COMMENT_PARAM);

	useEffect(() => {
		let active = true;
		setLoading(true);
		getComments(target)
			.then((data) => { if (active) setComments(data); })
			.catch(() => { if (active) setError("Failed to load comments"); })
			.finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	// target is stable for the page lifetime
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [target.kind, target.id, focusId]);

	// Once the comments are in, scroll to the linked one and highlight it for a moment.
	const [highlightedId, setHighlightedId] = useState<string | null>(null);
	useEffect(() => {
		if (loading || !focusId) return;
		const row = document.getElementById(COMMENT_ANCHOR(focusId));
		if (!row) return;
		row.scrollIntoView({ behavior: "smooth", block: "center" });
		setHighlightedId(focusId);
		const timer = window.setTimeout(() => setHighlightedId(null), 2500);
		return () => window.clearTimeout(timer);
	}, [loading, focusId]);

	async function handleAdd(content: string, asPageId: string | null) {
		const created = await createComment(target, { content, asPageId });
		setComments((prev) => [...prev, created]);
	}

	async function handleEdit(id: string, content: string) {
		const updated = await updateComment(id, content);
		setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
	}

	async function handleDelete(id: string) {
		await deleteComment(id);
		setComments((prev) => prev.filter((c) => c.id !== id));
	}

	const detailUrl = target.kind === "post" ? POST_DETAIL(target.id) : EVENT_DETAIL(target.id);
	const count = comments.length;

	return (
		<ContentCard className="px-8 py-6">
			<h2 id="comments" className="mb-4 flex items-center gap-2 text-lg font-semibold text-rich-brown">
				<MessageIcon className="h-5 w-5 text-misty-forest" />
				Comments
				{count > 0 && <span className="font-normal text-misty-forest">· {count}</span>}
			</h2>

			{loading ? (
				<p className="text-sm text-misty-forest">Loading comments…</p>
			) : error ? (
				<p className="text-sm text-novel-red">{error}</p>
			) : count === 0 ? (
				<DashedPlaceholder className="p-6 text-center text-sm text-misty-forest">
					No comments yet — be the first.
				</DashedPlaceholder>
			) : (
				<div className="space-y-5">
					{comments.map((comment) => (
						<CommentRow
							key={comment.id}
							comment={comment}
							isHighlighted={comment.id === highlightedId}
							isFromOwner={!comment.deleted && isFromOwner(comment, ownerUserId, ownerPageId)}
							canEdit={!comment.deleted && comment.authorId === currentUser?.id}
							canDelete={!comment.deleted && (isContentOwner || comment.authorId === currentUser?.id)}
							onEdit={handleEdit}
							onDelete={handleDelete}
						/>
					))}
				</div>
			)}

			{/* Below the thread, where a new comment lands (oldest-first reads top to bottom). */}
			<div className="mt-6">
				{isLoggedIn ? (
					<CommentComposer onSubmit={handleAdd} />
				) : (
					<Link
						href={LOGIN_WITH_CALLBACK(detailUrl)}
						className="text-sm font-medium text-moss-green hover:text-rich-brown"
					>
						Log in to comment →
					</Link>
				)}
			</div>
		</ContentCard>
	);
}
