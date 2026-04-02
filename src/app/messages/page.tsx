import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageLayout } from "@/lib/components/layout/PageLayout";
import { MessagesPageView } from "@/lib/components/messages/MessagesPageView";
import { LOGIN_WITH_CALLBACK, MESSAGES } from "@/lib/const/routes";

export default async function MessagesPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(MESSAGES));
	}

	return (
		<PageLayout>
			<div className="max-w-5xl mx-auto w-full">
				<h1 className="text-3xl font-bold mb-6">Messages</h1>
				<MessagesPageView />
			</div>
		</PageLayout>
	);
}
