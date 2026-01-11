/**
 * PRIVATE ORG PROFILE PAGE
 * 
 * This is the org's private profile page at /o/profile.
 * - Protected route (requires authentication and activeOrgId in session)
 * - Used for viewing org profile information and quick actions
 * - Does NOT display collections (projects/events)
 * - Links to settings and edit pages
 * 
 * For the public profile view with collections, see: /o/[slug]
 */
import { auth } from "@/lib/auth";
import { getOrgById, getUserOrgRole } from "@/lib/utils/server/org";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, PUBLIC_ORG_PAGE, PROJECT_NEW, EVENT_NEW, HOME, COLLECTIONS } from "@/lib/const/routes";
import { ActorProfileDisplay } from "@/lib/components/actor/ActorProfileDisplay";
import { Actor } from "@/lib/types/actor";

export default async function OrgProfilePage() {
	const session = await auth();

	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK("/o/profile"));
	}

	// Check if user has activeOrgId in session
	const activeOrgId = session.user.activeOrgId;
	if (!activeOrgId) {
		// No active org, redirect to settings to select one
		redirect("/o/profile/settings");
	}

	// Get org and verify user has permission
	const org = await getOrgById(activeOrgId);
	if (!org) {
		// Org doesn't exist, clear activeOrgId and redirect to settings
		redirect("/o/profile/settings");
	}

	// Verify user has permission to act as this org
	const role = await getUserOrgRole(session.user.id, org.id);
	if (!role || role === "FOLLOWER") {
		// User lost permission, redirect to settings
		redirect("/o/profile/settings");
	}

	// Create Actor type for the org
	const actor: Actor = { type: "ORG", data: org };

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">Org Profile</h1>
				<p className="text-gray-600">Manage {org.name}'s profile information and settings</p>
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Profile Information</h2>
				<ActorProfileDisplay actor={actor} />
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
				<div className="flex flex-col gap-3">
					<ButtonLink href={PUBLIC_ORG_PAGE(org.slug)} variant="secondary" fullWidth>
						View Public Profile
					</ButtonLink>
					<ButtonLink href="/o/profile/edit" variant="secondary" fullWidth>
						Edit Profile
					</ButtonLink>
					<ButtonLink href="/o/profile/settings" variant="secondary" fullWidth>
						Settings
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
