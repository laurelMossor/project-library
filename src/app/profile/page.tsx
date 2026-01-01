/**
 * PRIVATE PROFILE / SETTINGS PAGE
 * 
 * This is the user's private profile settings page at /profile.
 * - Protected route (requires authentication)
 * - Used for editing profile information and account settings
 * - Does NOT display collections (projects/events)
 * - Provides quick actions and links to other pages
 * 
 * For the public profile view with collections, see: /u/[username]
 */
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EditableProfile } from "@/lib/components/user/EditableProfile";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, PRIVATE_USER_PAGE, PROFILE_EDIT, PUBLIC_USER_PAGE, PROJECT_NEW, EVENT_NEW, HOME, COLLECTIONS } from "@/lib/const/routes";

export default async function ProfilePage() {
	// Middleware protects this route, but we verify session here as a safety check
	const session = await auth();

	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
	}

	const userId = session.user.id;
	const user = await getUserById(userId);

	if (!user) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
	}

	return (
		<CenteredLayout maxWidth="2xl">
				<div className="mb-8">
					<h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
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
						<ButtonLink href={PROFILE_EDIT} variant="secondary" fullWidth>
							Edit Profile (Full Form)
						</ButtonLink>
						<ButtonLink href={PROJECT_NEW} variant="secondary" fullWidth>
							Create New Project
						</ButtonLink>
						<ButtonLink href={EVENT_NEW} variant="secondary" fullWidth>
							Create New Event
						</ButtonLink>
					</div>
				</div>

				<div className="flex gap-4 justify-center">
					<Link href={HOME} className="text-sm underline text-gray-600">Home</Link>
					<Link href={COLLECTIONS} className="text-sm underline text-gray-600">Collections</Link>
				</div>
		</CenteredLayout>
	);
}
