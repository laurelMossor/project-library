"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Message {
	id: string;
	content: string;
	senderId: string;
	receiverId: string;
	createdAt: string;
	readAt: string | null;
	sender: {
		id: string;
		username: string;
		name: string | null;
	};
	receiver: {
		id: string;
		username: string;
		name: string | null;
	};
}

interface OtherUser {
	id: string;
	username: string;
	name: string | null;
}

// Helper function to format timestamp
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

export default function ConversationPage() {
	const router = useRouter();
	const params = useParams();
	const userId = params?.userId as string;
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const [messages, setMessages] = useState<Message[]>([]);
	const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [content, setContent] = useState("");
	const [sending, setSending] = useState(false);

	// Fetch messages and user info
	useEffect(() => {
		fetchConversation();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userId]);

	// Scroll to bottom when messages change
	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const fetchConversation = async () => {
		setLoading(true);
		setError("");

		try {
			const res = await fetch(`/api/messages/${userId}`);

			if (!res.ok) {
				if (res.status === 401) {
					router.push("/login?callbackUrl=/messages");
					return;
				}
				if (res.status === 404) {
					setError("User not found");
					setLoading(false);
					return;
				}
				throw new Error("Failed to fetch conversation");
			}

			const data = await res.json();

			// Handle response format: either array of messages or object with messages and otherUser
			if (Array.isArray(data)) {
				setMessages(data);
				// Get other user info from first message if available
				if (data.length > 0) {
					// Determine other user from first message
					// The userId param is the other user's ID, so we can get their info from sender or receiver
					const otherUserData = data[0].senderId === userId ? data[0].sender : data[0].receiver;
					setOtherUser(otherUserData);
				}
			} else if (data.messages && data.otherUser) {
				// Response includes otherUser info (for empty conversations)
				setMessages(data.messages);
				setOtherUser(data.otherUser);
			} else {
				setMessages([]);
			}
		} catch (err) {
			setError("Failed to load conversation");
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim() || sending) return;

		setSending(true);
		setError("");

		try {
			const res = await fetch("/api/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					receiverId: userId,
					content: content.trim(),
				}),
			});

			if (!res.ok) {
				if (res.status === 401) {
					router.push("/login?callbackUrl=/messages");
					return;
				}
				const data = await res.json();
				setError(data.error || "Failed to send message");
				setSending(false);
				return;
			}

			const newMessage = await res.json();
			setMessages([...messages, newMessage]);
			setContent("");

			// Update other user info if we don't have it yet
			if (!otherUser) {
				setOtherUser(newMessage.receiver);
			}
		} catch (err) {
			setError("Failed to send message");
		} finally {
			setSending(false);
		}
	};

	if (loading) {
		return (
			<main className="flex min-h-screen items-center justify-center p-8">
				<p className="text-gray-600">Loading conversation...</p>
			</main>
		);
	}

	return (
		<main className="flex min-h-screen flex-col p-8">
			<div className="max-w-4xl mx-auto w-full flex flex-col h-[calc(100vh-200px)]">
				<div className="mb-4">
					<Link href="/messages" className="text-sm underline text-gray-600 mb-2 inline-block">
						← Back to Messages
					</Link>
					{otherUser && (
						<h1 className="text-2xl font-bold">
							Conversation with {otherUser.name || otherUser.username}
						</h1>
					)}
				</div>

				{error && messages.length === 0 && (
					<div className="text-center py-12">
						<p className="text-red-500">{error}</p>
					</div>
				)}

				{/* Messages area */}
				<div className="flex-1 overflow-y-auto border rounded p-4 mb-4 space-y-4">
					{messages.length === 0 && !loading ? (
						<div className="text-center py-12 text-gray-500">
							No messages yet. Start the conversation below!
						</div>
					) : (
						messages.map((message) => {
							// Determine if message was sent by current user (current user is sender, other user is receiver)
							// Since userId param is the other user's ID, if receiverId matches, we sent it
							const isSent = message.receiverId === userId;
							return (
								<div
									key={message.id}
									className={`flex ${isSent ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`max-w-[70%] rounded p-3 ${
											isSent
												? "bg-black text-white"
												: "bg-gray-200 text-black"
										}`}
									>
										<p className="whitespace-pre-wrap break-words">{message.content}</p>
										<p
											className={`text-xs mt-1 ${
												isSent ? "text-gray-300" : "text-gray-500"
											}`}
										>
											{formatMessageTime(message.createdAt)}
										</p>
									</div>
								</div>
							);
						})
					)}
					<div ref={messagesEndRef} />
				</div>

				{/* Message input form */}
				<form onSubmit={handleSubmit} className="flex gap-2">
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="Type a message..."
						className="flex-1 border rounded p-2 resize-none"
						rows={3}
						maxLength={5000}
						disabled={sending}
					/>
					<button
						type="submit"
						disabled={!content.trim() || sending}
						className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
					>
						{sending ? "Sending..." : "Send"}
					</button>
				</form>

				{error && messages.length > 0 && (
					<p className="text-red-500 text-sm mt-2">{error}</p>
				)}
			</div>
		</main>
	);
}

