"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { API_MESSAGE, API_MESSAGES, LOGIN_WITH_CALLBACK, MESSAGES } from "@/lib/const/routes";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";

interface Message {
	id: string;
	content: string;
	senderId: string;
	createdAt: string;
	readAt: string | null;
	sender: {
		id: string;
		username: string;
		firstName: string | null;
		lastName: string | null;
	};
}

interface ConversationThreadProps {
	targetId: string;
	targetType: "user" | "page";
	/** Sent on behalf of a page when the user is acting as one */
	asPageId?: string;
}

function formatMessageTime(date: Date | string): string {
	const messageDate = typeof date === "string" ? new Date(date) : date;
	const now = new Date();
	const diffMs = now.getTime() - messageDate.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return messageDate.toLocaleDateString();
}

export function ConversationThread({ targetId, targetType, asPageId }: ConversationThreadProps) {
	const router = useRouter();
	const { currentUser } = useActiveProfile();
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [content, setContent] = useState("");
	const [sending, setSending] = useState(false);

	useEffect(() => {
		fetchConversation();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [targetId, targetType]);

	// Poll for new messages every 60 seconds when visible
	useEffect(() => {
		if (sending) return;
		const intervalId = setInterval(() => {
			if (document.visibilityState === "visible") {
				fetchConversation(true);
			}
		}, 60000);
		return () => clearInterval(intervalId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [targetId, targetType, sending]);

	useEffect(() => {
		const el = messagesContainerRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages]);

	const fetchConversation = async (isBackgroundRefresh = false) => {
		if (!isBackgroundRefresh) setLoading(true);
		setError("");
		try {
			const res = await fetch(`${API_MESSAGE(targetId)}?type=${targetType}`);
			if (!res.ok) {
				if (res.status === 401) { router.push(LOGIN_WITH_CALLBACK(MESSAGES)); return; }
				if (res.status === 404) { setError("Not found"); if (!isBackgroundRefresh) setLoading(false); return; }
				throw new Error("Failed to fetch");
			}
			const data = await res.json();
			const newMessages: Message[] = data.messages ?? [];
			if (isBackgroundRefresh) {
				setMessages((current) => {
					const currentIds = new Set(current.map((m) => m.id));
					const hasNew = newMessages.some((m) => !currentIds.has(m.id));
					if (hasNew || newMessages.length !== current.length) {
						if (hasNew) setTimeout(() => { const el = messagesContainerRef.current; if (el) el.scrollTop = el.scrollHeight; }, 100);
						return newMessages;
					}
					return current;
				});
			} else {
				setMessages(newMessages);
			}
		} catch {
			if (!isBackgroundRefresh) setError("Failed to load conversation");
		} finally {
			if (!isBackgroundRefresh) setLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim() || sending) return;
		setSending(true);
		setError("");
		try {
			const body: Record<string, string> = { content: content.trim() };
			if (targetType === "user") body.recipientUserId = targetId;
			else body.recipientPageId = targetId;
			if (asPageId) body.asPageId = asPageId;

			const res = await fetch(API_MESSAGES, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				if (res.status === 401) { router.push(LOGIN_WITH_CALLBACK(MESSAGES)); return; }
				const data = await res.json();
				setError(data.error || "Failed to send message");
				setSending(false);
				return;
			}
			const newMessage = await res.json();
			setMessages((prev) => [...prev, newMessage]);
			setContent("");
			fetchConversation(true);
		} catch {
			setError("Failed to send message");
		} finally {
			setSending(false);
		}
	};

	if (loading) {
		return <div className="flex items-center justify-center h-48"><p className="text-sm text-dusty-grey">Loading...</p></div>;
	}

	return (
		<div className="flex flex-col h-full">
			{/* Messages area */}
			<div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
				{messages.length === 0 ? (
					<p className="text-center text-sm text-dusty-grey py-8">No messages yet. Start the conversation below!</p>
				) : (
					messages.map((message) => {
						const isSent = message.senderId === currentUser?.id;
						return (
							<div key={message.id} className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
								<div className={`max-w-[70%] rounded p-3 ${isSent ? "bg-black text-white" : "bg-gray-200 text-black"}`}>
									<p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
									<p className={`text-xs mt-1 ${isSent ? "text-gray-300" : "text-gray-500"}`}>
										{formatMessageTime(message.createdAt)}
									</p>
								</div>
							</div>
						);
					})
				)}
			</div>

			{error && <p className="text-red-500 text-sm px-4">{error}</p>}

			{/* Send form */}
			<form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-soft-grey">
				<textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							if (content.trim() && !sending) handleSubmit(e as unknown as React.FormEvent);
						}
					}}
					placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
					className="flex-1 border rounded p-2 resize-none text-sm"
					rows={2}
					maxLength={5000}
					disabled={sending}
				/>
				<Button type="submit" disabled={!content.trim() || sending} loading={sending} size="sm">
					Send
				</Button>
			</form>
		</div>
	);
}
