"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ConnectionsPageView } from "./ConnectionsPageView";
import { CardEntity, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import type { ConnectionsData } from "@/lib/types/connections";

type ConnectionsPageClientProps = {
	/** The identity the server rendered the lists for. */
	entity: CardEntity;
	currentUserId: string;
	data: ConnectionsData;
	initialTab?: string;
};

export function ConnectionsPageClient({ entity, currentUserId, data, initialTab }: ConnectionsPageClientProps) {
	const router = useRouter();
	const { activePageId } = useActiveProfile();
	const isPage = isCardPage(entity);
	const displayName = isPage ? entity.name : getCardUserDisplayName(entity);

	// Switching profiles in the nav changes the session but not this server-rendered page, so
	// re-render it once per switch. The ref stops a stale activePageId (one the server refused
	// and fell back to personal for) from refreshing in a loop.
	const refreshedFor = useRef(activePageId);
	useEffect(() => {
		if (activePageId === (isPage ? entity.id : null) || refreshedFor.current === activePageId) return;
		refreshedFor.current = activePageId;
		router.refresh();
	}, [activePageId, isPage, entity.id, router]);

	return (
		<>
			<div className="mb-6">
				<h1 className="text-2xl font-bold">
					{displayName}&apos;s Connections
				</h1>
			</div>
			<ConnectionsPageView
				key={entity.id}
				entity={entity}
				currentUserId={currentUserId}
				data={data}
				initialTab={initialTab}
			/>
		</>
	);
}
