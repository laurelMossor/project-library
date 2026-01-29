/**
 * PRIVATE ORG PROFILE PAGE
 * 
 * This is the org's private profile page at /o/profile.
 * - Protected route (requires authentication and activeOwnerId in session)
 * - Used for viewing org profile information and quick actions
 * - Does NOT display collections (projects/events)
 * - Links to settings and edit pages
 * 
 * For the public profile view with collections, see: /o/[slug]
 */
import { auth } from "@/lib/auth";
import { getOrgById, getUserOrgRole } from "@/lib/utils/server/org";
import { getOwnerById } from "@/lib/utils/server/owner";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, PUBLIC_ORG_PAGE, PROJECT_NEW, EVENT_NEW, HOME, COLLECTIONS, PRIVATE_ORG_PAGE, ORG_PROFILE_SETTINGS, ORG_PROFILE_EDIT } from "@/lib/const/routes";
import { OwnerProfileDisplay } from "@/lib/components/owner/OwnerProfileDisplay";
import { ProfileOwner } from "@/lib/types/profile-owner";

export default async function OrgProfilePage() {
	const session = await auth();

	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_ORG_PAGE));
	}

	// Check if user has activeOwnerId in session that points to an org
	const activeOwnerId = session.user.activeOwnerId;
	if (!activeOwnerId) {
		// No active owner, redirect to settings to select one
		redirect(ORG_PROFILE_SETTINGS);
	}

	// Get the owner and check if it's an org-based owner
	const activeOwner = await getOwnerById(activeOwnerId);
	if (!activeOwner || !activeOwner.orgId) {
		// Not an org owner, redirect to settings
		redirect(ORG_PROFILE_SETTINGS);
	}

	// Get org details
	const org = await getOrgById(activeOwner.orgId);
	if (!org) {
		// Org doesn't exist, redirect to settings
		redirect(ORG_PROFILE_SETTINGS);
	}

	// Verify user has permission to act as this org
	const role = await getUserOrgRole(session.user.id, org.id);
	if (!role) {
		// User lost permission, redirect to settings
		redirect(ORG_PROFILE_SETTINGS);
	}

	// Create ProfileOwner type for the org
	const profileOwner: ProfileOwner = { type: "ORG", data: org };

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">Org Profile</h1>
				<p className="text-gray-600">Manage {org.name}'s profile information and settings</p>
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Profile Information</h2>
				<OwnerProfileDisplay owner={profileOwner} />
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
				<div className="flex flex-col gap-3">
					<ButtonLink href={PUBLIC_ORG_PAGE(org.slug)} variant="secondary" fullWidth>
						View Public Profile
					</ButtonLink>
					<ButtonLink href={ORG_PROFILE_EDIT} variant="secondary" fullWidth>
						Edit Profile
					</ButtonLink>
					<ButtonLink href={ORG_PROFILE_SETTINGS} variant="secondary" fullWidth>
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
