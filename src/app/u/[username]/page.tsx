/**
 * PUBLIC USER PROFILE PAGE
 *
 * /u/[username] — visible to everyone.
 * When the viewing user owns this profile, fields are inline-editable
 * via InlineEditSession. Visitors see a read-only view.
 */
import { getUserByHandle } from "@/lib/utils/server/user";
import { notFound } from "next/navigation";
import { getEventsByUser } from "@/lib/utils/server/event";
import { getPostsByUser } from "@/lib/utils/server/post";
import { auth } from "@/lib/auth";
import { ProfileCollectionSection } from "@/lib/components/collection/ProfileCollectionSection";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileHeader } from "@/lib/components/profile/ProfileHeader";
import { ProfileButtons } from "@/lib/components/profile/ProfileButtons";
import { ProfileBody } from "@/lib/components/profile/ProfileBody";
import { UserProfileClient } from "@/lib/components/profile/UserProfileClient";
import { ProfileEntity } from "@/lib/types/profile";

type Props = {
	params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
	const { username } = await params;
	const [user, session] = await Promise.all([
		getUserByHandle(username),
		auth(),
	]);

	if (!user) {
		notFound();
	}

	const isOwnProfile = session?.user?.id === user.id;

	const [events, posts] = await Promise.all([
		getEventsByUser(user.id),
		// Owner sees their own drafts in the collection
		getPostsByUser(user.id, { includeOwner: isOwnProfile }),
	]);
	const collectionItems = [...events, ...posts];

	if (isOwnProfile) {
		return (
			<CenteredLayout maxWidth="6xl">
				<div className="mb-8">
					<UserProfileClient user={user} />
				</div>

				<ProfileCollectionSection
					items={collectionItems}
					title="History"
					emptyMessage={`${username} hasn't created anything yet.`}
					showCreateLinks={false}
					currentUserId={user.id}
				/>
			</CenteredLayout>
		);
	}

	const profile: ProfileEntity = { type: "USER", data: user };

	return (
		<CenteredLayout maxWidth="6xl">
			<div className="flex flex-col gap-6 mb-8">
				<div className="flex items-start justify-between gap-4">
					<ProfileHeader profile={profile} isOwnProfile={false} />
					<div className="flex flex-col gap-2 w-36 shrink-0">
						<ProfileButtons entityId={user.id} entityType="user" />
					</div>
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
