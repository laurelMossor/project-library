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
import { addCommentAction, deleteCommentAction, editCommentAction } from "@/lib/actions/comment";
import { useAction } from "@/lib/hooks/useAction";
import { POST_DETAIL, EVENT_DETAIL, LOGIN_WITH_CALLBACK, COMMENT_ANCHOR, COMMENT_PARAM } from "@/lib/const/routes";
import type { CommentItem, CommentTarget } from "@/lib/types/comment";
import type { ActionResult } from "@/lib/types/action";

type CommentSectionProps = {
	target: CommentTarget;
	/** The thread, oldest first, from the server render. Every change refreshes the page, which updates it. */
	comments: CommentItem[];
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

/** The composer and rows report failures by throwing; turn a refused action into that. */
function throwIfFailed(result: ActionResult<unknown>) {
	if (!result.ok && result.error !== "unauthorized") throw new Error(result.message);
}

/**
 * The "Comments" card that sits below a post/event. Renders the server-provided thread
 * (oldest first, so it reads top to bottom) and hosts the composer or a log-in prompt.
 * Comments inherit the parent's viewability — the server page gates that.
 */
export function CommentSection({ target, comments, ownerUserId, ownerPageId, isContentOwner, isLoggedIn }: CommentSectionProps) {
	const { currentUser } = useActiveProfile();
	const { run: add } = useAction(addCommentAction);
	const { run: edit } = useAction(editCommentAction);
	const { run: remove } = useAction(deleteCommentAction);

	// A notification links to `?comment=<id>`: scroll to that comment and highlight it for a moment.
	const focusId = useSearchParams().get(COMMENT_PARAM);
	const [highlightedId, setHighlightedId] = useState<string | null>(null);
	useEffect(() => {
		if (!focusId) return;
		const row = document.getElementById(COMMENT_ANCHOR(focusId));
		if (!row) return;
		row.scrollIntoView({ behavior: "smooth", block: "center" });
		setHighlightedId(focusId);
		const timer = window.setTimeout(() => setHighlightedId(null), 2500);
		return () => window.clearTimeout(timer);
	}, [focusId]);

	const detailUrl = target.kind === "post" ? POST_DETAIL(target.id) : EVENT_DETAIL(target.id);
	const count = comments.length;

	return (
		<ContentCard className="px-8 py-6">
			<h2 id="comments" className="mb-4 flex items-center gap-2 text-lg font-semibold text-rich-brown">
				<MessageIcon className="h-5 w-5 text-misty-forest" />
				Comments
				{count > 0 && <span className="font-normal text-misty-forest">· {count}</span>}
			</h2>

			{count === 0 ? (
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
							onEdit={async (id, content) => throwIfFailed(await edit({ id, content }))}
							onDelete={async (id) => throwIfFailed(await remove({ id }))}
						/>
					))}
				</div>
			)}

			{/* Below the thread, where a new comment lands (oldest-first reads top to bottom). */}
			<div className="mt-6">
				{isLoggedIn ? (
					<CommentComposer onSubmit={async (content, asPageId) => throwIfFailed(await add({ parent: target, content, asPageId }))} />
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
