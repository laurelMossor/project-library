/**
 * PRIVATE PAGE PROFILE
 *
 * This is the page's private profile at /p/profile.
 * - Protected route (requires authentication and activePageId in session)
 * - Used for viewing page profile information and quick actions
 * - Links to settings and edit pages
 *
 * For the public profile view with collections, see: /p/[slug]
 */
import { auth } from "@/lib/auth";
import { getPageById } from "@/lib/utils/server/page";
import { canManagePage, getPagesForUser } from "@/lib/utils/server/permission";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, HOME, COLLECTIONS, PRIVATE_PAGE, PRIVATE_USER_PAGE } from "@/lib/const/routes";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { PageProfileSettingsContent } from "./PageProfileSettingsContent";

export default async function PageProfilePage() {
	const session = await auth();

	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_PAGE));
	}

	// Check if user has activePageId in session
	const activePageId = session.user.activePageId;
	if (!activePageId) {
		// No active page, redirect to user profile
		redirect(PRIVATE_USER_PAGE);
	}

	// Verify user has permission on this page
	const [page, hasPermission, pages] = await Promise.all([
		getPageById(activePageId),
		canManagePage(session.user.id, activePageId),
		getPagesForUser(session.user.id),
	]);

	if (!page || !hasPermission) {
		// Page doesn't exist or user lost permission
		redirect(PRIVATE_USER_PAGE);
	}

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<HeadingTitle title="Page Profile" />
				<p className="text-gray-600">Manage {page.name}&apos;s profile information and settings</p>
			</div>

			<PageProfileSettingsContent page={page} pages={pages} />

			<div className="flex gap-4 justify-center">
				<Link href={HOME} className="text-sm underline text-gray-600">Home</Link>
				<Link href={COLLECTIONS} className="text-sm underline text-gray-600">Collections</Link>
			</div>
		</CenteredLayout>
	);
}
