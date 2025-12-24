import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getConversations } from "@/lib/utils/message";
import { truncateText } from "@/lib/utils/text";

// Helper function to format timestamp as relative time or date
function formatMessageTime(date: Date): string {
	const now = new Date();
	const messageDate = new Date(date);
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

export default async function MessagesPage() {
	// Protected route - redirect to login if not authenticated
	const session = await auth();

	if (!session?.user?.id) {
		redirect("/login?callbackUrl=/messages");
	}

	const conversations = await getConversations(session.user.id);

	return (
		<main className="flex min-h-screen flex-col p-8">
			<div className="max-w-4xl mx-auto w-full">
				<h1 className="text-3xl font-bold mb-6">Messages</h1>

				{conversations.length === 0 ? (
					<div className="text-center py-12">
						<p className="text-gray-600">No messages yet. Start a conversation by visiting someone's profile!</p>
					</div>
				) : (
					<div className="space-y-2">
						{conversations.map((conversation) => (
							<Link
								key={conversation.otherUser.id}
								href={`/messages/${conversation.otherUser.id}`}
								className="block border rounded p-4 hover:bg-gray-50 transition-colors"
							>
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<h2 className="font-semibold text-lg">
												{conversation.otherUser.name || conversation.otherUser.username}
											</h2>
											<span className="text-sm text-gray-500">
												@{conversation.otherUser.username}
											</span>
										</div>
										{conversation.lastMessage && (
											<div className="mt-2">
												<p className="text-gray-600 truncate">
													{conversation.lastMessage.senderId === session?.user?.id ? (
														<span>You: {truncateText(conversation.lastMessage.content)}</span>
													) : (
														<span>{truncateText(conversation.lastMessage.content)}</span>
													)}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{formatMessageTime(conversation.lastMessage.createdAt)}
												</p>
											</div>
										)}
									</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</main>
	);
}

