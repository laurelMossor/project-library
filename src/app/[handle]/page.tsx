/**
 * UNIFIED PUBLIC PROFILE — /[handle]
 *
 * The single entry point for the flat URL space (PR 2). Resolves the
 * `[handle]` segment via the `handles` table (the cross-entity uniqueness
 * layer), then dispatches to either the User or Page profile shape.
 *
 * Routing precedence: Next.js prefers static segments over dynamic, so
 * `/api/...`, `/explore`, `/messages`, etc. are never matched here. The
 * `RESERVED_HANDLES` set + the `check:reserved-handles` CI guard prevent
 * any new top-level static route from being claimed as a handle.
 *
 * The dispatcher does TWO queries by design:
 *   1. `findEntityByHandle` — single Handle-table lookup, returns raw
 *      User/Page rows. Used to determine entity type and 404-or-not.
 *   2. `getUserByHandle` / `getPageByHandle` — re-fetch with the public
 *      field-select shape (avatarImage join, etc.) the UI components
 *      already consume. This keeps `findEntityByHandle` small and lets
 *      the existing route bodies be mirrored 1:1 below.
 *
 * Both legacy URLs (`/u/[username]`, `/p/[slug]`) still exist and render
 * the same content — they're deleted in Task 14 once the cutover lands.
 */
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { findEntityByHandle } from "@/lib/utils/server/handle";
import { getUserByHandle } from "@/lib/utils/server/user";
import { getPageByHandle } from "@/lib/utils/server/page";
import { getEventsByUser, getEventsByPage } from "@/lib/utils/server/event";
import { getPostsByUser, getPostsByPage } from "@/lib/utils/server/post";
import { canManagePage } from "@/lib/utils/server/permission";
import { ProfileCollectionSection } from "@/lib/components/collection/ProfileCollectionSection";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileHeader } from "@/lib/components/profile/ProfileHeader";
import { ProfileButtons } from "@/lib/components/profile/ProfileButtons";
import { ProfileBody } from "@/lib/components/profile/ProfileBody";
import { JoinButton } from "@/lib/components/profile/JoinButton";
import { UserProfileClient } from "@/lib/components/profile/UserProfileClient";
import { PageProfileClient } from "@/lib/components/profile/PageProfileClient";
import { ProfileEntity } from "@/lib/types/profile";
import { getPageDisplayName } from "@/lib/types/page";

type Props = {
	params: Promise<{ handle: string }>;
};

export default async function HandleProfilePage({ params }: Props) {
	const { handle } = await params;

	const entity = await findEntityByHandle(handle);
	if (!entity) {
		notFound();
	}

	const session = await auth();
	const viewerId = session?.user?.id;

	// USER branch — mirrors the body of `src/app/u/[username]/page.tsx`.
	if (entity.user) {
		const user = await getUserByHandle(handle);
		if (!user) {
			// Entity-row exists but the public-shape fetch missed it. Treat as 404.
			notFound();
		}

		const isOwnProfile = viewerId === user.id;

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
						emptyMessage={`${handle} hasn't created anything yet.`}
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
					emptyMessage={`${handle} hasn't created anything yet.`}
					showCreateLinks={false}
				/>
			</CenteredLayout>
		);
	}

	// PAGE branch — mirrors the body of `src/app/p/[slug]/page.tsx`.
	if (entity.page) {
		const page = await getPageByHandle(handle);
		if (!page) {
			notFound();
		}

		const isOwner = viewerId ? await canManagePage(viewerId, page.id) : false;

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
						currentUserId={viewerId}
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

	// Structurally impossible: a Handle row must have either userId or pageId.
	// Belt-and-suspenders 404 in case of data corruption.
	notFound();
}
