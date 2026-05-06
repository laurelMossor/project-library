/**
 * About subpage — /[handle]/about
 *
 * Works for both User and Page profiles. Displays the longform `aboutContent`
 * markdown body. If the viewer can edit, shows an inline editor. If the
 * viewer cannot edit and the content is empty/null, 404s.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { findEntityByHandle } from "@/lib/utils/server/handle";
import { getUserByHandle } from "@/lib/utils/server/user";
import { getPageByHandle } from "@/lib/utils/server/page";
import { canManagePage } from "@/lib/utils/server/permission";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { MarkdownBody } from "@/lib/components/markdown/MarkdownBody";
import { AboutPageClient } from "@/lib/components/profile/AboutPageClient";
import { PUBLIC_PROFILE } from "@/lib/const/routes";
import { getUserDisplayName } from "@/lib/types/user";
import { getPageDisplayName } from "@/lib/types/page";

type Props = { params: Promise<{ handle: string }> };

export default async function HandleAboutPage({ params }: Props) {
	const { handle } = await params;

	const entity = await findEntityByHandle(handle);
	if (!entity) notFound();

	const session = await auth();
	const viewerId = session?.user?.id;

	// ── User branch ──────────────────────────────────────────────────────────
	if (entity.user) {
		const user = await getUserByHandle(handle);
		if (!user) notFound();

		const canEdit = viewerId === user.id;
		if (!canEdit && !user.aboutContent) notFound();

		const displayName = getUserDisplayName(user);
		const avatarEntity = {
			id: user.id,
			handle: user.handle,
			displayName: user.displayName,
			firstName: user.firstName,
			lastName: user.lastName,
			avatarImageId: user.avatarImageId,
			avatarImage: user.avatarImage,
		};

		return (
			<CenteredLayout maxWidth="3xl">
				<div className="flex flex-col gap-8">
					<div>
						<Link
							href={PUBLIC_PROFILE(handle)}
							className="text-sm text-dusty-grey hover:text-rich-brown transition-colors"
						>
							← Back to {displayName}
						</Link>
					</div>

					<div className="flex items-center gap-3">
						<ProfilePicture entity={avatarEntity} size="sm" asLink={false} />
						<div>
							<p className="font-medium">{displayName}</p>
							<p className="text-sm text-dusty-grey">@{handle}</p>
						</div>
					</div>

					<div>
						{canEdit ? (
							<AboutPageClient
								entityType="user"
								entityId={user.id}
								initialAboutContent={user.aboutContent}
								canEdit
							/>
						) : (
							<MarkdownBody content={user.aboutContent!} />
						)}
					</div>
				</div>
			</CenteredLayout>
		);
	}

	// ── Page branch ───────────────────────────────────────────────────────────
	if (entity.page) {
		const page = await getPageByHandle(handle);
		if (!page) notFound();

		const canEdit = viewerId ? await canManagePage(viewerId, page.id) : false;
		if (!canEdit && !page.aboutContent) notFound();

		const displayName = getPageDisplayName(page);
		const avatarEntity = {
			id: page.id,
			name: page.name,
			handle: page.handle,
			avatarImageId: page.avatarImageId,
			avatarImage: page.avatarImage,
		};

		return (
			<CenteredLayout maxWidth="3xl">
				<div className="flex flex-col gap-8">
					<div>
						<Link
							href={PUBLIC_PROFILE(handle)}
							className="text-sm text-dusty-grey hover:text-rich-brown transition-colors"
						>
							← Back to {displayName}
						</Link>
					</div>

					<div className="flex items-center gap-3">
						<ProfilePicture entity={avatarEntity} size="sm" asLink={false} />
						<div>
							<p className="font-medium">{displayName}</p>
							<p className="text-sm text-dusty-grey">@{handle}</p>
						</div>
					</div>

					<div>
						{canEdit ? (
							<AboutPageClient
								entityType="page"
								entityId={page.id}
								initialAboutContent={page.aboutContent}
								canEdit
							/>
						) : (
							<MarkdownBody content={page.aboutContent!} />
						)}
					</div>
				</div>
			</CenteredLayout>
		);
	}

	notFound();
}
