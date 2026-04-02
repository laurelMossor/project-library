/**
 * PUBLIC PROFILE PAGE
 *
 * This is the public profile view at /u/[username].
 * - Publicly accessible (no authentication required)
 * - Displays user's profile information and collections (events + posts)
 *
 * For the private settings page, see: /u/profile
 */
import { getUserByUsername } from "@/lib/utils/server/user";
import { notFound } from "next/navigation";
import { getEventsByUser } from "@/lib/utils/server/event";
import { getPostsByUser } from "@/lib/utils/server/post";
import { ProfileCollectionSection } from "@/lib/components/collection/ProfileCollectionSection";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileHeader } from "@/lib/components/profile/ProfileHeader";
import { ProfileButtons } from "@/lib/components/profile/ProfileButtons";
import { ProfileBody } from "@/lib/components/profile/ProfileBody";
import { ProfileEntity } from "@/lib/types/profile";

type Props = {
	params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
	const { username } = await params;
	const user = await getUserByUsername(username);

	if (!user) {
		notFound();
	}

	const profile: ProfileEntity = { type: "USER", data: user };

	const [events, posts] = await Promise.all([
		getEventsByUser(user.id),
		getPostsByUser(user.id),
	]);
	const collectionItems = [...events, ...posts];

	return (
		<CenteredLayout maxWidth="6xl">
			<div className="flex flex-col gap-6 mb-8">
				<div className="flex items-start justify-between gap-4">
					<ProfileHeader profile={profile} />
					<ProfileButtons entityId={user.id} entityType="user" />
				</div>
				<ProfileBody profile={profile} />
			</div>

			<ProfileCollectionSection
				items={collectionItems}
				title="History"
				emptyMessage={`${username} hasn't created anything yet.`}
				showCreateLinks={false}
			/>
		</CenteredLayout>
	);
}
