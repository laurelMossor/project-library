"use client";

import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ConnectionsPageView } from "./ConnectionsPageView";
import { isCardPage, getCardUserDisplayName } from "@/lib/types/card";

export function ConnectionsPageClient({ initialTab }: { initialTab?: string }) {
	const { activeEntity, currentUser, loading } = useActiveProfile();

	if (loading || !currentUser || !activeEntity) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

	const isPage = isCardPage(activeEntity);
	const displayName = isPage ? activeEntity.name : getCardUserDisplayName(activeEntity);

	return (
		<>
			<div className="mb-6">
				<h1 className="text-2xl font-bold">
					{displayName}&apos;s Connections
				</h1>
			</div>
			<ConnectionsPageView entity={activeEntity} currentUserId={currentUser.id} initialTab={initialTab} />
		</>
	);
}
