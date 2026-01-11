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
import { getProjectsByActor } from "@/lib/utils/server/project";
import { getEventsByActor } from "@/lib/utils/server/event";
import { UserCollectionSection } from "@/lib/components/collection/UserCollectionSection";
import { ActorProfileHeader } from "@/lib/components/actor/ActorProfileHeader";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { Actor } from "@/lib/types/actor";
import { getUserOrgRole } from "@/lib/utils/server/org";

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
		isOwnProfile = role !== null && role !== "FOLLOWER";
	}

	// Create Actor type for the org
	const actor: Actor = { type: "ORG", data: org };

	// Fetch org's projects and events
	const [projects, events] = await Promise.all([
		getProjectsByActor(org.actorId),
		getEventsByActor(org.actorId),
	]);

	// Combine into collection items
	const collectionItems = [...projects, ...events];

	return (
		<CenteredLayout maxWidth="6xl">
			<ActorProfileHeader 
				actor={actor} 
				isOwnProfile={isOwnProfile} 
				session={session}
				currentUserId={session?.user?.id || null}
			/>

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

