"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { LocalDate } from "@/lib/components/ui/LocalDate";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import {
	API_CONVERSATION,
	API_CONVERSATION_MESSAGES,
	LOGIN_WITH_CALLBACK,
	MESSAGES,
} from "@/lib/const/routes";
import { resolveCardIdentity } from "@/lib/types/card";
import type { ConversationThreadData, ThreadMessage } from "@/lib/types/message";
import { AvatarStack } from "./AvatarStack";
import { MembersModal } from "./MembersModal";
import { conversationTitle, fullName, memberEntity, otherMembers } from "./conversation-display";

interface ConversationThreadProps {
	conversationId: string;
	/** The page the viewer is acting as, if any (verified server-side on every request). */
	asPageId?: string;
	/** Fired after the thread is marked read, so the inbox can un-bold its row. */
	onRead?: (conversationId: string) => void;
	/** Fired when the viewer leaves the group. */
	onLeft?: (conversationId: string) => void;
	/** Fired when the group's name/members change, so the inbox can refresh its title. */
	onChanged?: (thread: ConversationThreadData) => void;
}

const POLL_MS = 60_000;

/** Same author as the previous message → collapse the name/avatar into one run.
 * Tombstones key on `deleted` plus the message id, so two deleted speakers never merge. */
const authorKey = (m: ThreadMessage) => {
	if (m.deleted) return `deleted:${m.deleted}:${m.id}`;
	return m.author.type === "page" ? `page:${m.author.page?.id}` : `user:${m.author.user?.id}`;
};

function deletedLabel(deleted: ThreadMessage["deleted"], kind: "author" | "message") {
	if (!deleted) return null;
	if (kind === "message") return "[message deleted]";
	return deleted === "PAGE" ? "[page deleted]" : "[user deleted]";
}

export function ConversationThread({ conversationId, asPageId, onRead, onLeft, onChanged }: ConversationThreadProps) {
	const router = useRouter();
	const { activeEntity, currentUser } = useActiveProfile();
	const messagesRef = useRef<HTMLDivElement>(null);
	const seenIds = useRef<Set<string>>(new Set());

	const [thread, setThread] = useState<ConversationThreadData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [content, setContent] = useState("");
	const [sending, setSending] = useState(false);
	const [membersOpen, setMembersOpen] = useState(false);

	// Parent callbacks live in a ref so an inline handler never re-triggers the fetch effects.
	const onReadRef = useRef(onRead);
	useEffect(() => { onReadRef.current = onRead; }, [onRead]);

	/**
	 * Load (or, in the background, refresh) the thread; resolves to the data, or null on failure.
	 * The GET handler marks the thread read up to the newest message it returns. The cursor is that
	 * message's timestamp, so one that arrives after this response stays unread.
	 */
	const fetchThread = useCallback(async (background = false): Promise<ConversationThreadData | null> => {
		if (!background) { setLoading(true); setError(""); }
		try {
			const res = await fetch(API_CONVERSATION(conversationId, asPageId));
			if (res.status === 401) { router.push(LOGIN_WITH_CALLBACK(MESSAGES)); return null; }
			if (res.status === 404) { setError("This conversation isn't available."); setThread(null); return null; }
			if (!res.ok) throw new Error("Failed to fetch");
			const data: ConversationThreadData = await res.json();
			const hasNew = data.messages.some((m) => !seenIds.current.has(m.id));
			seenIds.current = new Set(data.messages.map((m) => m.id));
			setThread(data);
			// Tell the inbox/nav to drop this conversation's unread state — the fetch above already did
			// the marking server-side. Skip the no-op case (an empty thread, or a background poll with
			// nothing new) so we don't dispatch an event for nothing.
			if ((!background || hasNew) && data.messages.length > 0) {
				onReadRef.current?.(conversationId);
				window.dispatchEvent(new Event("messages:read"));
			}
			return data;
		} catch {
			if (!background) setError("Failed to load conversation");
			return null;
		} finally {
			if (!background) setLoading(false);
		}
	}, [conversationId, asPageId, router]);

	useEffect(() => {
		seenIds.current = new Set();
		fetchThread();
	}, [fetchThread]);

	useEffect(() => {
		if (sending) return;
		const id = setInterval(() => {
			if (document.visibilityState === "visible") fetchThread(true);
		}, POLL_MS);
		return () => clearInterval(id);
	}, [fetchThread, sending]);

	useEffect(() => {
		const el = messagesRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [thread?.messages.length]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim() || sending) return;
		setSending(true);
		setError("");
		try {
			const res = await fetch(API_CONVERSATION_MESSAGES(conversationId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: content.trim(), asPageId }),
			});
			if (res.status === 401) { router.push(LOGIN_WITH_CALLBACK(MESSAGES)); return; }
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Failed to send message");
				return;
			}
			setContent("");
			await fetchThread(true);
		} catch {
			setError("Failed to send message");
		} finally {
			setSending(false);
		}
	};

	if (loading) {
		return <div className="flex items-center justify-center h-48"><p className="text-sm text-dusty-grey">Loading...</p></div>;
	}
	if (!thread) {
		return <div className="flex items-center justify-center h-48"><p className="text-sm text-dusty-grey">{error || "Not found"}</p></div>;
	}

	const isGroup = thread.kind === "GROUP";
	const others = otherMembers(thread);
	const actingName = activeEntity ? resolveCardIdentity(activeEntity).name : "";

	return (
		<div className="flex flex-col h-full">
			{isGroup && (
				<header className="flex items-center gap-3 px-4 py-3 border-b border-soft-grey">
					<AvatarStack entities={others.map(memberEntity)} total={others.length} />
					<div className="min-w-0 flex-1">
						<h2 className="text-sm font-semibold text-rich-brown truncate">{conversationTitle(thread)}</h2>
						<p className="text-xs text-dusty-grey">{thread.members.length} members</p>
					</div>
					<Button variant="secondary" size="sm" onClick={() => setMembersOpen(true)}>Members</Button>
				</header>
			)}

			<div ref={messagesRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 min-h-0" aria-live="polite">
				{thread.messages.length === 0 ? (
					<p className="text-center text-sm text-dusty-grey py-8">No messages yet. Start the conversation below!</p>
				) : (
					<ol className="flex flex-col">
						{thread.messages.map((m, i) => {
							const prev = thread.messages[i - 1];
							const startsRun = !prev || authorKey(prev) !== authorKey(m) || prev.isOwn !== m.isOwn;
							// Co-managers see which colleague spoke for the page (only ever on the page's own
							// messages — the server strips it for everyone else), but not when it was them.
							const sentBy = m.sentBy && m.sentBy.id !== currentUser?.id ? fullName({ type: "user", user: m.sentBy }) : null;
							return (
								<MessageBubble
									key={m.id}
									message={m}
									startsRun={startsRun}
									showAuthor={isGroup && !m.isOwn}
									sentBy={sentBy}
								/>
							);
						})}
					</ol>
				)}
			</div>

			{error && <p className="text-novel-red text-sm px-4 pb-1">{error}</p>}

			{thread.deletedCounterpart ? (
				<p className="border-t border-soft-grey px-4 py-3 text-sm text-dusty-grey">
					This conversation is closed.
				</p>
			) : (
			<form onSubmit={handleSubmit} className="border-t border-soft-grey px-3 pt-2 pb-3 sm:px-4">
				<div className="flex items-center gap-1.5 text-xs text-dusty-grey mb-1.5">
					{activeEntity && <ProfilePicture entity={activeEntity} size="sm" asLink={false} className="!w-5 !h-5 !text-[9px]" />}
					<span>Sending as <span className="font-medium text-rich-brown">{actingName}</span></span>
				</div>
				<div className="flex items-end gap-2">
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								if (content.trim() && !sending) handleSubmit(e as unknown as React.FormEvent);
							}
						}}
						placeholder="Type a message…"
						aria-label="Message"
						className="flex-1 min-w-0 rounded-xl border border-soft-grey bg-white/70 px-3 py-2 text-sm resize-none focus:outline-none focus:border-misty-forest"
						rows={2}
						maxLength={5000}
						disabled={sending}
					/>
					<Button type="submit" disabled={!content.trim() || sending} loading={sending} size="sm" className="rounded-xl">
						Send
					</Button>
				</div>
				<p className="hidden sm:block text-[11px] text-dusty-grey mt-1">Enter to send · Shift+Enter for a new line</p>
			</form>
			)}

			{membersOpen && (
				<MembersModal
					thread={thread}
					asPageId={asPageId ?? null}
					onClose={() => setMembersOpen(false)}
					onChanged={async () => {
						const data = await fetchThread(true);
						if (data) onChanged?.(data);
					}}
					onLeft={() => { setMembersOpen(false); onLeft?.(conversationId); }}
				/>
			)}
		</div>
	);
}

function MessageBubble({ message, startsRun, showAuthor, sentBy }: {
	message: ThreadMessage;
	startsRun: boolean;
	showAuthor: boolean;
	sentBy: string | null;
}) {
	const own = message.isOwn;
	const author = message.deleted ? null : memberEntity(message.author);
	const authorName = deletedLabel(message.deleted, "author") ?? fullName(message.author);
	const body = deletedLabel(message.deleted, "message") ?? message.content;
	return (
		<li className={`msg-in flex items-end gap-2 ${own ? "justify-end" : "justify-start"} ${startsRun ? "mt-3 first:mt-0" : "mt-1"}`}>
			{showAuthor && (
				<div className="w-8 shrink-0">
					{startsRun && author && <ProfilePicture entity={author} size="sm" />}
				</div>
			)}
			<div className={`flex flex-col max-w-[80%] sm:max-w-[70%] ${own ? "items-end" : "items-start"}`}>
				{showAuthor && startsRun && (
					<span className="text-xs font-medium text-misty-forest mb-0.5 px-1">
						{authorName}
					</span>
				)}
				<div
					className={`rounded-2xl px-3.5 py-2 ${
						own
							? "bg-melon-green text-rich-brown rounded-br-md"
							: "bg-rich-brown text-soft-grey rounded-bl-md"
					}`}
				>
					<p className="whitespace-pre-wrap break-words text-sm">{body}</p>
					<p className={`text-[11px] mt-1 ${own ? "text-rich-brown/60" : "text-soft-grey/60"}`}>
						<LocalDate value={message.createdAt} mode="relative" />
						{own && sentBy && <> · sent by {sentBy}</>}
					</p>
				</div>
			</div>
		</li>
	);
}
