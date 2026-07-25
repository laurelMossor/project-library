"use client";

import Link from "next/link";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ConnectionsPageView } from "./ConnectionsPageView";
import { isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { PUBLIC_PROFILE } from "@/lib/const/routes";

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
				<Link
					href={PUBLIC_PROFILE(activeEntity.handle)}
					className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
				>
					&larr; Back to {displayName}&apos;s profile
				</Link>
				<h1 className="text-2xl font-bold mt-2">
					{displayName}&apos;s Connections
				</h1>
			</div>
			<ConnectionsPageView entity={activeEntity} currentUserId={currentUser.id} initialTab={initialTab} />
		</>
	);
}
