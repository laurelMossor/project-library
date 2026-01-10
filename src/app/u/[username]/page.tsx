/**
 * PUBLIC PROFILE PAGE
 * 
 * This is the public profile view at /u/[username].
 * - Publicly accessible (no authentication required)
 * - Displays user's profile information and collections (projects/events)
 * - Shows action buttons based on viewer (own profile vs. other user's profile)
 * - Used for sharing and discovering user content
 * 
 * For the private settings page, see: /profile
 */
import { getUserByUsername } from "@/lib/utils/server/user";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getProjectsByUser } from "@/lib/utils/server/project";
import { getEventsByUser } from "@/lib/utils/server/event";
import { UserCollectionSection } from "@/lib/components/collection/UserCollectionSection";
import { UserProfileHeader } from "@/lib/components/user/UserProfileHeader";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";

type Props = {
	params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
	const { username } = await params;
	const user = await getUserByUsername(username);
	const session = await auth();

	if (!user) {
		notFound();
	}

	// Check if viewing own profile (only show message button if viewing another user's profile)
	const isOwnProfile = session?.user?.id === user.id;

	// Fetch user's projects and events
	const [projects, events] = await Promise.all([
		getProjectsByUser(user.id),
		getEventsByUser(user.id),
	]);

	// Combine into collection items
	const collectionItems = [...projects, ...events];

	return (
		<CenteredLayout maxWidth="6xl">
			<UserProfileHeader user={user} isOwnProfile={isOwnProfile} session={session} />

			{/* User's Collection Section */}
			<UserCollectionSection 
				items={collectionItems} 
				title={`${username}'s Collection`}
				emptyMessage={`${username} hasn't created any projects or events yet.`}
				showCreateLinks={false}
			/>
		</CenteredLayout>
	);
}
