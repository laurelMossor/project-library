"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { PageLayout } from "@/lib/components/layout/PageLayout";
import { ConversationThread } from "@/lib/components/messages/ConversationThread";
import { MESSAGES } from "@/lib/const/routes";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";

export default function ConversationPage() {
	const params = useParams();
	const userId = params?.userId as string;
	const { activePageId } = useActiveProfile();

	return (
		<PageLayout>
			<div className="max-w-4xl mx-auto w-full flex flex-col h-[calc(100vh-200px)]">
				<div className="mb-4">
					<Link href={MESSAGES} className="text-sm underline mb-2 inline-block">
						← Back to Messages
					</Link>
				</div>
				<div className="flex-1 border border-soft-grey rounded-xl overflow-hidden flex flex-col">
					<ConversationThread
						targetId={userId}
						targetType="user"
						asPageId={activePageId ?? undefined}
					/>
				</div>
			</div>
		</PageLayout>
	);
}
