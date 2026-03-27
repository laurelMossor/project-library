/**
 * PUBLIC PAGE PROFILE
 *
 * This is the public page profile view at /p/[slug].
 * - Publicly accessible (no authentication required)
 * - Displays page's profile information and collections (events)
 * - Shows action buttons based on viewer permissions
 *
 * For the private settings page, see: /p/profile
 */
import { getPageBySlug } from "@/lib/utils/server/page";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getEventsByPage } from "@/lib/utils/server/event";
import { getPostsByPage } from "@/lib/utils/server/post";
import { ProfileCollectionSection } from "@/lib/components/collection/ProfileCollectionSection";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { canManagePage } from "@/lib/utils/server/permission";
import { getPageDisplayName } from "@/lib/types/page";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { FollowButton } from "@/lib/components/ui/FollowButton";
import { PAGE_PROFILE_SETTINGS } from "@/lib/const/routes";

type Props = {
	params: Promise<{ slug: string }>;
};

export default async function PublicPageProfilePage({ params }: Props) {
	const { slug } = await params;
	const page = await getPageBySlug(slug);
	const session = await auth();

	if (!page) {
		notFound();
	}

	// Check if current user has permissions on this page
	let canManage = false;
	if (session?.user?.id) {
		canManage = await canManagePage(session.user.id, page.id);
	}

	const displayName = getPageDisplayName(page);

	const [events, posts] = await Promise.all([
		getEventsByPage(page.id),
		getPostsByPage(page.id),
	]);
	const collectionItems = [...events, ...posts];

	return (
		<CenteredLayout maxWidth="6xl">
			<div className="flex flex-col gap-8 mb-8">
				<div className="flex items-center justify-between gap-3">
					<HeadingTitle title={displayName} />
					<div className="flex gap-2">
						<FollowButton targetId={page.id} targetType="page" currentUserId={session?.user?.id} />
						{canManage && (
							<ButtonLink href={PAGE_PROFILE_SETTINGS} variant="secondary" size="sm">
								Manage Page
							</ButtonLink>
						)}
					</div>
				</div>

				{/* Page profile info */}
				<div className="space-y-2">
					<p className="text-sm text-gray-500">@{page.slug}</p>
					{page.headline && (
						<p className="text-lg text-gray-700">{page.headline}</p>
					)}
					{page.bio && (
						<p className="text-gray-600">{page.bio}</p>
					)}
					{page.location && (
						<p className="text-sm text-gray-500">{page.location}</p>
					)}
					{page.interests && page.interests.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{page.interests.map((interest) => (
								<span key={interest} className="text-xs px-2 py-1 bg-gray-100 rounded">
									{interest}
								</span>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Page's Collection Section */}
			<ProfileCollectionSection
				items={collectionItems}
				title={`${displayName}'s Collection`}
				emptyMessage={`${displayName} hasn't created anything yet.`}
				showCreateLinks={false}
			/>
		</CenteredLayout>
	);
}
