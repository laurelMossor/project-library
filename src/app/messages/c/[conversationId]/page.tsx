"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { StandaloneThreadPage } from "@/lib/components/messages/StandaloneThreadPage";

/** /messages/c/:conversationId — a DM or group by id (the email deep-link target). */
function ThreadByIdPage() {
	const params = useParams();
	return <StandaloneThreadPage target={{ conversationId: params?.conversationId as string }} />;
}

export default function ConversationByIdPage() {
	return (
		<Suspense>
			<ThreadByIdPage />
		</Suspense>
	);
}
