"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { PageLayout } from "@/lib/components/layout/PageLayout";
import { ConversationThread } from "@/lib/components/messages/ConversationThread";
import { MESSAGES } from "@/lib/const/routes";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";

function ConversationPageInner() {
	const params = useParams();
	const targetId = params?.id as string;
	const targetType = params?.type === "p" ? "page" : "user";

	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const { activePageId, switchProfile } = useActiveProfile();

	// A notification-email deep link may carry ?asPageId=<page> so a page manager lands on the
	// page-owned conversation (their session default is personal). Consume it exactly once: switch the
	// session identity to that page — session stays the source of truth — then strip the param so the
	// app returns to clean, stateful URLs. Server re-checks canPostAsPage on the switch and the fetch,
	// so an unmanaged page just fails to switch and the thread 404s.
	const linkAsPageId = searchParams.get("asPageId");
	const consumedRef = useRef(false);
	const [preparing, setPreparing] = useState(!!linkAsPageId);

	useEffect(() => {
		if (consumedRef.current) return;
		consumedRef.current = true;
		if (!linkAsPageId) return;
		(async () => {
			if (linkAsPageId !== activePageId) {
				await switchProfile(linkAsPageId);
			}
			router.replace(pathname);
			setPreparing(false);
		})();
		// One-shot on mount; the ref guards against re-runs. Intentionally not reactive to deps.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<PageLayout>
			<div className="max-w-4xl mx-auto w-full flex flex-col h-[calc(100vh-200px)]">
				<div className="mb-4">
					<Link href={MESSAGES} className="text-sm underline mb-2 inline-block">
						← Back to Messages
					</Link>
				</div>
				<div className="flex-1 border border-soft-grey rounded-xl overflow-hidden flex flex-col">
					{preparing ? (
						<p className="p-4 text-misty-forest">Loading…</p>
					) : (
						<ConversationThread
							targetId={targetId}
							targetType={targetType}
							asPageId={activePageId ?? undefined}
						/>
					)}
				</div>
			</div>
		</PageLayout>
	);
}

export default function ConversationPage() {
	return (
		<Suspense>
			<ConversationPageInner />
		</Suspense>
	);
}
