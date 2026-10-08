"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { StandaloneThreadPage } from "@/lib/components/messages/StandaloneThreadPage";

/** /messages/u/:userId or /messages/p/:pageId — the DM with that party, under the active identity. */
function DirectThreadPage() {
	const params = useParams();
	const id = params?.id as string;
	const type = params?.type === "p" ? "page" : "user";
	return <StandaloneThreadPage target={{ dmWith: { type, id } }} />;
}

export default function ConversationPage() {
	return (
		<Suspense>
			<DirectThreadPage />
		</Suspense>
	);
}
