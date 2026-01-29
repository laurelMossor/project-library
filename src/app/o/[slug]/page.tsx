/**
 * PUBLIC ORG PROFILE PAGE
 * 
 * This is the public org profile view at /o/[slug].
 * - Publicly accessible (no authentication required)
 * - Displays org's profile information and collections (projects/events)
 * - Shows action buttons based on viewer (own org vs. other org)
 * - Used for sharing and discovering org content
 * 
 * For the private settings page, see: /o/profile
 */
import { getOrgBySlug } from "@/lib/utils/server/org";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getProjectsByOwner } from "@/lib/utils/server/project";
import { getEventsByOwner } from "@/lib/utils/server/event";
import { UserCollectionSection } from "@/lib/components/collection/UserCollectionSection";
import { OwnerProfileHeader } from "@/lib/components/owner/OwnerProfileHeader";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileOwner } from "@/lib/types/profile-owner";
import { getUserOrgRole } from "@/lib/utils/server/org";
import { FollowersList, FollowingList } from "@/lib/components/owner/FollowersList";

type Props = {
	params: Promise<{ slug: string }>;
};

export default async function PublicOrgProfilePage({ params }: Props) {
	const { slug } = await params;
	const org = await getOrgBySlug(slug);
	const session = await auth();

	if (!org) {
		notFound();
	}

	// Check if viewing own org (user is a member with appropriate role)
	let isOwnProfile = false;
	if (session?.user?.id) {
		const role = await getUserOrgRole(session.user.id, org.id);
		// Consider OWNER, ADMIN, and MEMBER as "own profile" for editing purposes
		isOwnProfile = role !== null;
	}

	// Create ProfileOwner type for the org
	const profileOwner: ProfileOwner = { type: "ORG", data: org };

	// Fetch org's projects and events using org's primary owner
	const [projects, events] = await Promise.all([
		getProjectsByOwner(org.ownerId),
		getEventsByOwner(org.ownerId),
	]);

	// Combine into collection items
	const collectionItems = [...projects, ...events];

	return (
		<CenteredLayout maxWidth="6xl">
			<OwnerProfileHeader 
				owner={profileOwner} 
				isOwnProfile={isOwnProfile} 
				session={session}
				currentUserId={session?.user?.id || null}
			/>

			{/* Followers and Following */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
				<FollowersList ownerId={org.ownerId} title="Followers" />
				<FollowingList ownerId={org.ownerId} title="Following" />
			</div>

			{/* Org's Collection Section */}
			<UserCollectionSection 
				items={collectionItems} 
				title={`${org.name}'s Collection`}
				emptyMessage={`${org.name} hasn't created any projects or events yet.`}
				showCreateLinks={false}
			/>
		</CenteredLayout>
	);
}
