"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/lib/components/layout/PageLayout";
import { Breadcrumb } from "@/lib/components/layout/Breadcrumb";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { MESSAGES } from "@/lib/const/routes";
import { resolveDirectConversationAction } from "@/lib/actions/message";
import { ConversationThread } from "./ConversationThread";

type Target =
	| { conversationId: string }
	/** A DM addressed by the other party — resolved (created if needed) under the active identity. */
	| { dmWith: { type: "user" | "page"; id: string } };

/**
 * Full-page thread for deep links: /messages/c/:conversationId (email links) and /messages/u|p/:id
 * (profile "Message" button). A link may carry ?asPageId=<page> so a page manager lands under the page
 * identity (their session default is personal). It's consumed exactly once: switch the session identity
 * — session stays the source of truth — then strip the param. The server re-checks canPostAsPage on the
 * switch and every request, so an unmanaged page just fails to switch and the thread 404s.
 */
export function StandaloneThreadPage({ target }: { target: Target }) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const { activePageId, switchProfile } = useActiveProfile();

	const linkAsPageId = searchParams.get("asPageId");
	const consumedRef = useRef(false);
	const [preparing, setPreparing] = useState(!!linkAsPageId);

	useEffect(() => {
		if (consumedRef.current) return;
		consumedRef.current = true;
		if (!linkAsPageId) return;
		(async () => {
			if (linkAsPageId !== activePageId) await switchProfile(linkAsPageId);
			router.replace(pathname);
			setPreparing(false);
		})();
		// One-shot on mount; the ref guards against re-runs. Intentionally not reactive to deps.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const conversationId = useResolvedConversationId(target, activePageId, preparing);

	return (
		<PageLayout>
			<div className="max-w-4xl mx-auto w-full flex flex-col h-[calc(100vh-200px)]">
				<div className="mb-4">
					<Breadcrumb href={MESSAGES} label="Back to Messages" />
				</div>
				<div className="flex-1 border border-soft-grey rounded-xl overflow-hidden flex flex-col bg-grey-white min-h-0">
					{preparing || conversationId === undefined ? (
						<p className="p-4 text-misty-forest">Loading…</p>
					) : conversationId === null ? (
						<p className="p-4 text-misty-forest">This conversation isn&apos;t available.</p>
					) : (
						<ConversationThread
							key={`${conversationId}:${activePageId ?? ""}`}
							conversationId={conversationId}
							asPageId={activePageId ?? undefined}
							onLeft={() => router.push(MESSAGES)}
						/>
					)}
				</div>
			</div>
		</PageLayout>
	);
}

/** undefined = resolving; null = not available. Re-resolves when the acting identity changes. */
function useResolvedConversationId(target: Target, activePageId: string | null, paused: boolean): string | null | undefined {
	const direct = "conversationId" in target ? target.conversationId : null;
	const dmType = "dmWith" in target ? target.dmWith.type : null;
	const dmId = "dmWith" in target ? target.dmWith.id : null;
	const [resolved, setResolved] = useState<{ key: string; id: string | null } | null>(null);
	const key = `${dmType}:${dmId}:${activePageId ?? ""}`;

	useEffect(() => {
		if (direct || paused || !dmType || !dmId) return;
		let cancelled = false;
		// Called directly (not through useAction): this resolves on mount, and any failure
		// (including a signed-out session) renders as "not available" rather than an error.
		resolveDirectConversationAction({ target: { type: dmType, id: dmId }, asPageId: activePageId })
			.then((r) => { if (!cancelled) setResolved({ key, id: r.ok ? r.data : null }); })
			.catch(() => { if (!cancelled) setResolved({ key, id: null }); });
		return () => { cancelled = true; };
	}, [direct, paused, dmType, dmId, activePageId, key]);

	if (direct) return direct;
	return resolved?.key === key ? resolved.id : undefined;
}
