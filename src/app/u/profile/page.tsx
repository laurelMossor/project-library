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
import { EditableProfile } from "@/lib/components/user/EditableProfile";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, PUBLIC_USER_PAGE, PROJECT_NEW, EVENT_NEW, HOME, COLLECTIONS, PRIVATE_USER_PAGE, USER_PROFILE_SETTINGS, USER_PROFILE_EDIT, ORG_NEW } from "@/lib/const/routes";

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
				<h1 className="text-3xl font-bold mb-2">Profile</h1>
				<p className="text-gray-600">Manage your profile information and account settings</p>
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Profile Information</h2>
				<EditableProfile user={user} />
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
				<div className="flex flex-col gap-3">
					<ButtonLink href={PUBLIC_USER_PAGE(user.username)} variant="secondary" fullWidth>
						View Public Profile
					</ButtonLink>
					<ButtonLink href={USER_PROFILE_EDIT} variant="secondary" fullWidth>
						Edit Profile
					</ButtonLink>
					<ButtonLink href={USER_PROFILE_SETTINGS} variant="secondary" fullWidth>
						Settings
					</ButtonLink>
					<ButtonLink href={PROJECT_NEW} variant="secondary" fullWidth>
						Create New Project
					</ButtonLink>
					<ButtonLink href={EVENT_NEW} variant="secondary" fullWidth>
						Create New Event
					</ButtonLink>
					<ButtonLink href={ORG_NEW} variant="secondary" fullWidth>
						Create Organization
					</ButtonLink>
				</div>
			</div>

			{orgs.length > 0 && (
				<div className="bg-white border rounded-lg p-6 mb-6">
					<h2 className="text-xl font-semibold mb-4">Organizations</h2>
					<p className="text-sm text-gray-600 mb-4">You belong to {orgs.length} organization{orgs.length !== 1 ? 's' : ''}. Switch to an org profile in Settings.</p>
					<ButtonLink href={USER_PROFILE_SETTINGS} variant="secondary" fullWidth>
						Go to Settings
					</ButtonLink>
				</div>
			)}

			<div className="flex gap-4 justify-center">
				<Link href={HOME} className="text-sm underline text-gray-600">Home</Link>
				<Link href={COLLECTIONS} className="text-sm underline text-gray-600">Collections</Link>
			</div>
		</CenteredLayout>
	);
}
