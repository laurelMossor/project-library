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
import { getOrgById, getUserOrgRole, getOrgsForUser } from "@/lib/utils/server/org";
import { getOwnerById } from "@/lib/utils/server/owner";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, PRIVATE_ORG_PAGE, ORG_PROFILE_SETTINGS } from "@/lib/const/routes";
import { ProfileOwner } from "@/lib/types/profile-owner";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { OrgProfileSettingsContent } from "./OrgProfileSettingsContent";

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

	// Get org details and user's orgs in parallel
	const [org, orgs] = await Promise.all([
		getOrgById(activeOwner.orgId),
		getOrgsForUser(session.user.id),
	]);

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
				<HeadingTitle title="Org Profile" />
				<p className="text-gray-600">Manage {org.name}&apos;s profile information and settings</p>
			</div>

			<OrgProfileSettingsContent org={profileOwner} orgs={orgs} />
		</CenteredLayout>
	);
}
