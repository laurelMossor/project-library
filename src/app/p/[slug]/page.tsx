/**
 * PUBLIC PAGE PROFILE
 *
 * /p/[slug] — visible to everyone.
 * When the viewing user is an admin of this page, profile fields are
 * inline-editable via InlineEditSession. All other visitors see a read-only view.
 */
import { getPageByHandle } from "@/lib/utils/server/page";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManagePage } from "@/lib/utils/server/permission";
import { getEventsByPage } from "@/lib/utils/server/event";
import { getPostsByPage } from "@/lib/utils/server/post";
import { ProfileCollectionSection } from "@/lib/components/collection/ProfileCollectionSection";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileHeader } from "@/lib/components/profile/ProfileHeader";
import { ProfileButtons } from "@/lib/components/profile/ProfileButtons";
import { ProfileBody } from "@/lib/components/profile/ProfileBody";
import { JoinButton } from "@/lib/components/profile/JoinButton";
import { PageProfileClient } from "@/lib/components/profile/PageProfileClient";
import { ProfileEntity } from "@/lib/types/profile";
import { getPageDisplayName } from "@/lib/types/page";

type Props = {
	params: Promise<{ slug: string }>;
};

export default async function PublicPageProfilePage({ params }: Props) {
	const { slug } = await params;

	const [page, session] = await Promise.all([
		getPageByHandle(slug),
		auth(),
	]);

	if (!page) {
		notFound();
	}

	const userId = session?.user?.id;
	const isOwner = userId ? await canManagePage(userId, page.id) : false;

	const [events, posts] = await Promise.all([
		getEventsByPage(page.id),
		// Owners see their own drafts in the collection
		getPostsByPage(page.id, { includeOwner: isOwner }),
	]);
	const collectionItems = [...events, ...posts];
	const displayName = getPageDisplayName(page);

	if (isOwner) {
		return (
			<CenteredLayout maxWidth="6xl">
				<div className="mb-8">
					<PageProfileClient page={page} />
				</div>

				<ProfileCollectionSection
					items={collectionItems}
					title={`${displayName}'s Collection`}
					emptyMessage={`${displayName} hasn't created anything yet.`}
					showCreateLinks={false}
					currentUserId={userId}
				/>
			</CenteredLayout>
		);
	}

	const profile: ProfileEntity = { type: "PAGE", data: page };

	return (
		<CenteredLayout maxWidth="6xl">
			<div className="flex flex-col gap-6 mb-8">
				<div className="flex items-start justify-between gap-4">
					<ProfileHeader profile={profile} />
					<div className="flex flex-col gap-2 w-36 shrink-0">
						<ProfileButtons entityId={page.id} entityType="page" />
						<JoinButton pageId={page.id} />
					</div>
				</div>
				<ProfileBody profile={profile} />
			</div>

			<ProfileCollectionSection
				items={collectionItems}
				title={`${displayName}'s Collection`}
				emptyMessage={`${displayName} hasn't created anything yet.`}
				showCreateLinks={false}
			/>
		</CenteredLayout>
	);
}
