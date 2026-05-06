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
import type { CardEntity } from "@/lib/types/card";

type Props = { params: Promise<{ handle: string }> };

export default async function HandleAboutPage({ params }: Props) {
	const { handle } = await params;

	const entity = await findEntityByHandle(handle);
	if (!entity) notFound();

	const session = await auth();
	const viewerId = session?.user?.id;

	let canEdit: boolean;
	let aboutContent: string | null;
	let displayName: string;
	let avatarEntity: CardEntity;
	let entityType: "user" | "page";
	let entityId: string;

	if (entity.user) {
		const user = await getUserByHandle(handle);
		if (!user) notFound();
		canEdit = viewerId === user.id;
		aboutContent = user.aboutContent;
		displayName = getUserDisplayName(user);
		entityType = "user";
		entityId = user.id;
		avatarEntity = {
			id: user.id,
			handle: user.handle,
			displayName: user.displayName,
			firstName: user.firstName,
			lastName: user.lastName,
			avatarImageId: user.avatarImageId,
			avatarImage: user.avatarImage,
		};
	} else if (entity.page) {
		const page = await getPageByHandle(handle);
		if (!page) notFound();
		canEdit = viewerId ? await canManagePage(viewerId, page.id) : false;
		aboutContent = page.aboutContent;
		displayName = getPageDisplayName(page);
		entityType = "page";
		entityId = page.id;
		avatarEntity = {
			id: page.id,
			name: page.name,
			handle: page.handle,
			avatarImageId: page.avatarImageId,
			avatarImage: page.avatarImage,
		};
	} else {
		notFound();
	}

	if (!canEdit && !aboutContent) notFound();

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
							entityType={entityType}
							entityId={entityId}
							initialAboutContent={aboutContent}
							canEdit
						/>
					) : (
						<MarkdownBody content={aboutContent!} />
					)}
				</div>
			</div>
		</CenteredLayout>
	);
}
