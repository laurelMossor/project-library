/**
 * PRIVATE USER PROFILE PAGE
 * 
 * This is the user's private profile page at /u/profile.
 * - Protected route (requires authentication)
 * - Used for viewing profile information and quick actions
 * - Does NOT display collections (projects/events)
 * - Links to settings and edit pages
 * 
 * For the public profile view with collections, see: /u/[username]
 */
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { getOrgsForUser } from "@/lib/utils/server/org";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, HOME, COLLECTIONS, PRIVATE_USER_PAGE } from "@/lib/const/routes";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { ProfileSettingsContent } from "./ProfileSettingsContent";

export default async function UserProfilePage() {
	// Verify session
	const session = await auth();

	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
	}

	const userId = session.user.id;
	const [user, orgs] = await Promise.all([
		getUserById(userId),
		getOrgsForUser(userId),
	]);

	if (!user) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
	}

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<HeadingTitle title="Profile Settings" />
				<p className="text-gray-600">Manage your profile information and account settings</p>
			</div>

			<ProfileSettingsContent user={user} orgs={orgs} />

			<div className="flex gap-4 justify-center">
				<Link href={HOME} className="text-sm underline text-gray-600">Home</Link>
				<Link href={COLLECTIONS} className="text-sm underline text-gray-600">Collections</Link>
			</div>
		</CenteredLayout>
	);
}
