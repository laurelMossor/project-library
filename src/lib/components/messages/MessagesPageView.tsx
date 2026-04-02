"use client";

import { useState, useEffect, useRef } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/ui/TabbedPanel";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { ConversationThread } from "./ConversationThread";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { CardUser, CardPageWithRole, getCardUserDisplayName } from "@/lib/types/card";
import { truncateText } from "@/lib/utils/text";
import { API_MESSAGE } from "@/lib/const/routes";

// ─── Types ───────────────────────────────────────────────────────────────────

type TopTabId = string; // "dm" | <targetEntityId>

type ActiveEntityMeta = TabDef<string> & {
	entityType: "user" | "page";
	entityId: string;
	entity: CardUser | CardPageWithRole;
};

type ThreadMeta = {
	targetType: "user" | "page";
	asPageId?: string;
};

type Participant = {
	id: string;
	user: {
		id: string;
		username: string;
		firstName: string | null;
		lastName: string | null;
		displayName: string | null;
		avatarImageId: string | null;
	} | null;
	page: {
		id: string;
		name: string;
		slug: string;
		avatarImageId: string | null;
	} | null;
};

type ConversationItem = {
	id: string;
	updatedAt: string;
	participants: Participant[];
	lastMessage: {
		id: string;
		content: string;
		senderId: string;
		asPageId: string | null;
		createdAt: string;
		readAt: string | null;
	} | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const DM_TAB: TabDef<TopTabId> = { id: "dm", label: "Direct Messages" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMessageTime(date: string): string {
	const messageDate = new Date(date);
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

/** Returns the participant that is NOT the given entity (the "other party"). */
function getOtherParticipant(participants: Participant[], selfId: string, selfType: "user" | "page"): Participant | null {
	const self = participants.find((p) =>
		selfType === "user" ? p.user?.id === selfId : p.page?.id === selfId
	);
	if (!self) return participants[0] ?? null;
	return participants.find((p) => p !== self) ?? null;
}

function getParticipantDisplayName(p: Participant | null): string {
	if (!p) return "Unknown";
	if (p.user) return [p.user.firstName, p.user.lastName].filter(Boolean).join(" ") || p.user.username;
	if (p.page) return p.page.name;
	return "Unknown";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MessagesPageView() {
	const { currentUser, activeEntity, activePageId, loading: profileLoading } = useActiveProfile();

	const [topTabs, setTopTabs] = useState<TabDef<TopTabId>[]>([DM_TAB]);
	const [activeTop, setActiveTop] = useState<TopTabId>("dm");
	const [threadMetas, setThreadMetas] = useState<Record<string, ThreadMeta>>({});

	const [conversations, setConversations] = useState<ConversationItem[]>([]);
	const [inboxLoading, setInboxLoading] = useState(true);
	const [inboxError, setInboxError] = useState<string | null>(null);

	// Track previous entity to detect profile switches
	const prevEntityId = useRef<string | null>(null);

	// Reload inbox and reset threads when active profile changes
	useEffect(() => {
		if (!activeEntity?.id) return;
		if (prevEntityId.current !== null && prevEntityId.current !== activeEntity.id) {
			// Profile switched — close open threads
			setTopTabs([DM_TAB]);
			setActiveTop("dm");
			setThreadMetas({});
		}
		prevEntityId.current = activeEntity.id;
		fetchInbox();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeEntity?.id]);

	async function fetchInbox() {
		setInboxLoading(true);
		setInboxError(null);
		try {
			const res = await fetch("/api/messages/inbox");
			if (!res.ok) throw new Error("Failed to load");
			setConversations(await res.json());
		} catch {
			setInboxError("Failed to load conversations");
		} finally {
			setInboxLoading(false);
		}
	}

	function openThread(targetId: string, targetType: "user" | "page", displayName: string, asPageId?: string) {
		setThreadMetas((prev) => ({ ...prev, [targetId]: { targetType, asPageId } }));
		setTopTabs((prev) => {
			if (prev.some((t) => t.id === targetId)) return prev;
			return [...prev, { id: targetId, label: displayName, closeable: true }];
		});
		setActiveTop(targetId);

		// Mark all unread messages in this conversation as read, then update local state
		fetch(API_MESSAGE(targetId), { method: "PATCH" })
			.then((r) => r.ok ? r.json() : null)
			.then((result) => {
				if (result && result.updated > 0) {
					setConversations((prev) =>
						prev.map((conv) => {
							if (!conv.lastMessage || conv.lastMessage.readAt !== null) return conv;
							const hasTarget = conv.participants.some((p) =>
								p.user?.id === targetId || p.page?.id === targetId
							);
							if (!hasTarget) return conv;
							return { ...conv, lastMessage: { ...conv.lastMessage, readAt: new Date().toISOString() } };
						})
					);
					window.dispatchEvent(new Event("messages:read"));
				}
			})
			.catch(() => {});
	}

	function closeThread(tabId: string) {
		setTopTabs((prev) => prev.filter((t) => t.id !== tabId));
		setThreadMetas(({ [tabId]: _, ...rest }) => rest);
		setActiveTop("dm");
	}

	if (profileLoading || !currentUser || !activeEntity) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

	const activeEntityType: "user" | "page" = activePageId ? "page" : "user";

	const activeEntityMeta: ActiveEntityMeta = activePageId
		? {
			id: activeEntity.id,
			label: (activeEntity as CardPageWithRole).name,
			entityType: "page",
			entityId: activeEntity.id,
			entity: activeEntity as CardPageWithRole,
		}
		: {
			id: currentUser.id,
			label: getCardUserDisplayName(currentUser),
			entityType: "user",
			entityId: currentUser.id,
			entity: currentUser,
		};

	const leftTabs = [activeEntityMeta];

	function renderConversationList() {
		if (inboxLoading) return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
		if (inboxError) return <p className="text-sm text-red-500 text-center py-12">{inboxError}</p>;

		const entityId = activeEntityMeta.entityId;
		const filtered = conversations.filter((conv) =>
			conv.participants.some((p) =>
				activeEntityType === "user" ? p.user?.id === entityId : p.page?.id === entityId
			)
		);

		if (filtered.length === 0) {
			return <p className="text-sm text-dusty-grey text-center py-12">No messages yet.</p>;
		}

		return (
			<div className="divide-y divide-soft-grey/50">
				{filtered.map((conv) => {
					const other = getOtherParticipant(conv.participants, entityId, activeEntityType);
					const displayName = getParticipantDisplayName(other);
					const targetId = other?.user?.id ?? other?.page?.id ?? "";
					const targetType: "user" | "page" = other?.user ? "user" : "page";

					// Unread: last message was sent by the other party and hasn't been read
					const isUnread = !!(
						conv.lastMessage &&
						conv.lastMessage.readAt === null &&
						conv.lastMessage.senderId !== currentUser?.id
					);

					const previewText = conv.lastMessage
						? (conv.lastMessage.senderId === currentUser?.id || conv.lastMessage.asPageId === entityId
							? `You: ${truncateText(conv.lastMessage.content)}`
							: truncateText(conv.lastMessage.content))
						: null;

					return (
						<button
							key={conv.id}
							onClick={() => openThread(targetId, targetType, displayName, activeEntityType === "page" ? entityId : undefined)}
							className="w-full text-left px-5 py-4 hover:bg-ash-green/30 transition-colors"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<p className={`text-sm text-rich-brown ${isUnread ? "font-semibold" : "font-medium"}`}>
										{displayName}
									</p>
									{previewText && (
										<p className={`text-xs mt-0.5 truncate ${isUnread ? "font-semibold text-rich-brown" : "text-dusty-grey"}`}>
											{previewText}
										</p>
									)}
								</div>
								{conv.lastMessage && (
									<p className={`text-xs shrink-0 ${isUnread ? "font-semibold text-rich-brown" : "text-dusty-grey"}`}>
										{formatMessageTime(conv.lastMessage.createdAt)}
									</p>
								)}
							</div>
						</button>
					);
				})}
			</div>
		);
	}

	function renderContent(_leftId: string, topId: TopTabId) {
		if (topId === "dm") {
			return renderConversationList();
		}
		// Thread tab — independent of left tab
		const meta = threadMetas[topId];
		if (!meta) return null;
		return (
			<div className="flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
				<ConversationThread targetId={topId} targetType={meta.targetType} asPageId={meta.asPageId} />
			</div>
		);
	}

	return (
		<TabbedPanel<TopTabId, string>
			key={activeEntity.id}
			topTabs={topTabs}
			leftTabs={leftTabs}
			activeTop={activeTop}
			onActiveTopChange={setActiveTop}
			onTopTabClose={closeThread}
			renderLeftTab={(tab) => {
				const meta = tab as ActiveEntityMeta;
				return (
					<ProfileTag
						entity={meta.entity as CardUser | CardPageWithRole}
						badge={meta.entityType === "page" && (meta.entity as CardPageWithRole).role
							? (meta.entity as CardPageWithRole).role!.toLowerCase()
							: undefined}
						asLink={false}
						variant="compact"
						align="right"
						className="!border-0 !bg-transparent hover:!bg-transparent w-full"
					/>
				);
			}}
			renderContent={renderContent}
			defaultLeft={activeEntityMeta.id}
		/>
	);
}
