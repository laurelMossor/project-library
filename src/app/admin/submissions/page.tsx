import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { listOpenSubmissions } from "@/lib/utils/server/event-submission";
import { SubmissionsClient } from "./SubmissionsClient";

/**
 * /admin/submissions — Poster Catcher review surface (superadmin-gated by the admin layout).
 * Lists open submissions and lets the operator edit, approve (publish/draft), or reject.
 * The list is read here so each review action's refresh re-renders it; the target events
 * page is passed from server env so the browser never hardcodes it.
 */
export default async function SubmissionsPage() {
	const eventsPageId = process.env.POSTER_CATCHER_PAGE_ID || null;
	const submissions = await listOpenSubmissions();

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<HeadingTitle title="Poster Catcher" />
				<p className="text-gray-600">Review captured events, then approve or reject them.</p>
			</div>
			<SubmissionsClient submissions={submissions} eventsPageId={eventsPageId} />
		</CenteredLayout>
	);
}
