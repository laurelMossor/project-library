/**
 * PUBLIC PAGE PROFILE
 *
 * This is the public page profile view at /p/[slug].
 * - Publicly accessible (no authentication required)
 * - Displays page's profile information and collections (events + posts)
 *
 * For the private settings page, see: /p/profile
 */
import { getPageBySlug } from "@/lib/utils/server/page";
import { notFound } from "next/navigation";
import { getEventsByPage } from "@/lib/utils/server/event";
import { getPostsByPage } from "@/lib/utils/server/post";
import { ProfileCollectionSection } from "@/lib/components/collection/ProfileCollectionSection";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileHeader } from "@/lib/components/profile/ProfileHeader";
import { ProfileButtons } from "@/lib/components/profile/ProfileButtons";
import { ProfileBody } from "@/lib/components/profile/ProfileBody";
import { JoinButton } from "@/lib/components/profile/JoinButton";
import { ProfileEntity } from "@/lib/types/profile";
import { getPageDisplayName } from "@/lib/types/page";

type Props = {
	params: Promise<{ slug: string }>;
};

export default async function PublicPageProfilePage({ params }: Props) {
	const { slug } = await params;
	const page = await getPageBySlug(slug);

	if (!page) {
		notFound();
	}

	const profile: ProfileEntity = { type: "PAGE", data: page };
	const displayName = getPageDisplayName(page);

	const [events, posts] = await Promise.all([
		getEventsByPage(page.id),
		getPostsByPage(page.id),
	]);
	const collectionItems = [...events, ...posts];

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
