"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/layout/TabbedPanel";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { Button } from "@/lib/components/ui/Button";
import { LocalDate } from "@/lib/components/ui/LocalDate";
import { ConversationThread } from "./ConversationThread";
import { NewGroupModal } from "./NewGroupModal";
import { AvatarStack } from "./AvatarStack";
import { conversationTitle, memberEntity, otherMembers, shortName } from "./conversation-display";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { CardUser, CardPageWithRole, getCardUserDisplayName } from "@/lib/types/card";
import type { ConversationSummary, ConversationThreadData } from "@/lib/types/message";
import { truncateText } from "@/lib/utils/text";
import { API_MESSAGES_INBOX } from "@/lib/const/routes";

// ─── Types ───────────────────────────────────────────────────────────────────

type TopTabId = string; // "dm" | <conversationId>

type ActiveEntityMeta = TabDef<string> & {
	entityType: "user" | "page";
	entityId: string;
	entity: CardUser | CardPageWithRole;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const INBOX_TAB: TabDef<TopTabId> = { id: "dm", label: "Inbox" };
/** Open thread tabs beyond this close the oldest, so the tab strip (and the Inbox tab) stays readable. */
const MAX_OPEN_THREADS = 3;
const MAX_OPEN_THREADS_MOBILE = 1;

function previewText(c: ConversationSummary): string | null {
	const m = c.lastMessage;
	if (!m) return c.kind === "GROUP" ? "No messages yet" : null;
	const body = m.deleted ? "[message deleted]" : truncateText(m.content);
	if (m.isOwn) return `You: ${body}`;
	return c.kind === "GROUP" ? `${shortName(m.author)}: ${body}` : body;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MessagesPageView() {
	const { currentUser, activeEntity, activePageId, loading: profileLoading } = useActiveProfile();

	const [topTabs, setTopTabs] = useState<TabDef<TopTabId>[]>([INBOX_TAB]);
	const [activeTop, setActiveTop] = useState<TopTabId>("dm");

	const [conversations, setConversations] = useState<ConversationSummary[]>([]);
	const [inboxLoading, setInboxLoading] = useState(true);
	const [inboxError, setInboxError] = useState<string | null>(null);
	const [newGroupOpen, setNewGroupOpen] = useState(false);

	const isMobile = useIsMobile();
	const maxOpenThreads = isMobile ? MAX_OPEN_THREADS_MOBILE : MAX_OPEN_THREADS;

	// Track previous entity to detect profile switches
	const prevEntityId = useRef<string | null>(null);

	const fetchInbox = useCallback(async (): Promise<ConversationSummary[]> => {
		setInboxLoading(true);
		setInboxError(null);
		try {
			// Scoped to the active identity server-side — no client-side filtering.
			const res = await fetch(API_MESSAGES_INBOX(activePageId));
			if (!res.ok) throw new Error("Failed to load");
			const list: ConversationSummary[] = await res.json();
			setConversations(list);
			return list;
		} catch {
			setInboxError("Failed to load conversations");
			return [];
		} finally {
			setInboxLoading(false);
		}
	}, [activePageId]);

	// Reload inbox and reset threads when the active profile changes
	useEffect(() => {
		if (!activeEntity?.id) return;
		if (prevEntityId.current !== null && prevEntityId.current !== activeEntity.id) {
			setTopTabs([INBOX_TAB]);
			setActiveTop("dm");
		}
		prevEntityId.current = activeEntity.id;
		fetchInbox();
	}, [activeEntity?.id, fetchInbox]);

	function openThread(conversationId: string, label: string) {
		setTopTabs((prev) => {
			if (prev.some((t) => t.id === conversationId)) return prev;
			const threads = [...prev.slice(1), { id: conversationId, label, closeable: true }];
			return [INBOX_TAB, ...threads.slice(-maxOpenThreads)];
		});
		setActiveTop(conversationId);
	}

	function closeThread(tabId: string) {
		setTopTabs((prev) => prev.filter((t) => t.id !== tabId));
		setActiveTop("dm");
	}

	const markReadLocally = useCallback((conversationId: string) => {
		setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
	}, []);

	const handleThreadChanged = useCallback((thread: ConversationThreadData) => {
		setTopTabs((prev) => prev.map((t) => (t.id === thread.id ? { ...t, label: conversationTitle(thread) } : t)));
		fetchInbox();
	}, [fetchInbox]);

	const handleLeft = useCallback((conversationId: string) => {
		closeThread(conversationId);
		setConversations((prev) => prev.filter((c) => c.id !== conversationId));
	}, []);

	if (profileLoading || !currentUser || !activeEntity) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

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

	function renderConversationList() {
		return (
			<div>
				<div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-soft-grey/60">
					<p className="text-xs text-dusty-grey truncate">
						As <span className="font-medium text-rich-brown">{activeEntityMeta.label}</span>
					</p>
					<Button size="sm" variant="secondary" onClick={() => setNewGroupOpen(true)}>+ New group</Button>
				</div>
				{inboxLoading ? (
					<p className="text-sm text-dusty-grey text-center py-12">Loading...</p>
				) : inboxError ? (
					<p className="text-sm text-novel-red text-center py-12">{inboxError}</p>
				) : conversations.length === 0 ? (
					<p className="text-sm text-dusty-grey text-center py-12">No messages yet.</p>
				) : (
					<ul className="divide-y divide-soft-grey/50">
						{conversations.map((conv) => {
							const others = otherMembers(conv);
							const title = conversationTitle(conv);
							const isUnread = conv.unreadCount > 0;
							const preview = previewText(conv);
							return (
								<li key={conv.id}>
									<button
										onClick={() => openThread(conv.id, title)}
										className="w-full text-left px-4 py-3 sm:px-5 hover:bg-ash-green/30 transition-colors flex items-center gap-3"
									>
										<AvatarStack entities={others.map(memberEntity)} total={others.length} />
										<div className="min-w-0 flex-1">
											<div className="flex items-baseline justify-between gap-3">
												<p className={`text-sm text-rich-brown truncate ${isUnread ? "font-semibold" : "font-medium"}`}>
													{title}
												</p>
												{conv.lastMessage && (
													<p className={`text-xs shrink-0 ${isUnread ? "font-semibold text-rich-brown" : "text-dusty-grey"}`}>
														<LocalDate value={conv.lastMessage.createdAt} mode="relative" />
													</p>
												)}
											</div>
											<div className="flex items-center gap-2 mt-0.5">
												{preview && (
													<p className={`text-xs truncate flex-1 ${isUnread ? "font-semibold text-rich-brown" : "text-dusty-grey"}`}>
														{preview}
													</p>
												)}
												{isUnread && (
													<span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-moss-green text-grey-white text-[11px] font-semibold flex items-center justify-center" aria-label={`${conv.unreadCount} unread`}>
														{conv.unreadCount}
													</span>
												)}
											</div>
										</div>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		);
	}

	function renderContent(_leftId: string, topId: TopTabId) {
		if (topId === "dm") return renderConversationList();
		return (
			<div className="flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "420px" }}>
				<ConversationThread
					conversationId={topId}
					asPageId={activePageId ?? undefined}
					onRead={markReadLocally}
					onChanged={handleThreadChanged}
					onLeft={handleLeft}
				/>
			</div>
		);
	}

	return (
		<>
			<TabbedPanel<TopTabId, string>
				key={activeEntity.id}
				topTabs={topTabs}
				leftTabs={[activeEntityMeta]}
				activeTop={activeTop}
				onActiveTopChange={setActiveTop}
				onTopTabClose={closeThread}
				collapseLeftOnMobile
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
			{newGroupOpen && (
				<NewGroupModal
					actingKey={`${activeEntityMeta.entityType}:${activeEntityMeta.entityId}`}
					asPageId={activePageId}
					actingName={activeEntityMeta.label}
					onClose={() => setNewGroupOpen(false)}
					onCreated={async (conversationId) => {
						setNewGroupOpen(false);
						const created = (await fetchInbox()).find((c) => c.id === conversationId);
						openThread(conversationId, created ? conversationTitle(created) : "New group");
					}}
				/>
			)}
		</>
	);
}
