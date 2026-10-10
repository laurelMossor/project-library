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
import { findEntityByHandle } from "@/lib/utils/server/handle";
import { getUserByHandle } from "@/lib/utils/server/user";
import { getPageByHandle } from "@/lib/utils/server/page";
import { getEventsByUser, getEventsByPage } from "@/lib/utils/server/event";
import { getPostsByUser, getPostsByPage } from "@/lib/utils/server/post";
import { getFollowCounts } from "@/lib/utils/server/follow";
import { getMembershipStatus } from "@/lib/utils/server/requests";
import { canManagePage } from "@/lib/utils/server/permission";
import { getViewerContext, resolveProfileAccess } from "@/lib/utils/server/visibility";
import { ProfileCollectionSection } from "@/lib/components/collection/ProfileCollectionSection";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileBody } from "@/lib/components/profile/ProfileBody";
import { ProfileIdentityBlock } from "@/lib/components/profile/ProfileIdentityBlock";
import { LockedProfilePreview } from "@/lib/components/profile/LockedProfilePreview";
import { ProfileEditClient } from "@/lib/components/profile/ProfileEditClient";
import { ProfileEntity } from "@/lib/types/profile";
import { getPageDisplayName } from "@/lib/types/page";
import { getUserDisplayName } from "@/lib/types/user";
import { API_ME_USER, API_PAGE } from "@/lib/const/routes";
import { truncateText } from "@/lib/utils/text";
import type { AboutCollectionItem } from "@/lib/types/collection";

type Props = {
	params: Promise<{ handle: string }>;
	searchParams: Promise<{ edit?: string }>;
};

// TODO: dry this up considerably
export default async function HandleProfilePage({ params }: Props) {
	const { handle } = await params;

	const entity = await findEntityByHandle(handle);
	if (!entity) {
		notFound();
	}

	const viewer = await getViewerContext();
	const viewerId = viewer.userId;

	// USER branch — mirrors the body of `src/app/u/[username]/page.tsx`.
	if (entity.user) {
		const user = await getUserByHandle(handle);
		if (!user) {
			// Entity-row exists but the public-shape fetch missed it. Treat as 404.
			notFound();
		}

		const profile: ProfileEntity = { type: "USER", data: user };

		// Visibility gate: FULL renders the profile; LOCKED shows the identity-only private stub.
		const access = await resolveProfileAccess("USER", user, viewer);
		if (access === "LOCKED") return <LockedProfilePreview profile={profile} />;

		const isOwnProfile = viewerId === user.id;
		const userDisplayName = getUserDisplayName(user);

		const [events, posts, followCounts] = await Promise.all([
			getEventsByUser(user.id, { includeDrafts: isOwnProfile, viewer }),
			getPostsByUser(user.id, { includeDrafts: isOwnProfile, viewer }),
			getFollowCounts({ type: "USER", id: user.id }),
		]);
		const collectionItems = [...events, ...posts];

		const aboutCard: AboutCollectionItem | null = user.aboutContent
			? {
				type: "about",
				handle: user.handle,
				displayName: userDisplayName,
				excerpt: truncateText(user.aboutContent.replace(/[#*_`>\[\]]/g, ""), 200),
			}
			: null;

		if (isOwnProfile) {
			return (
				<CenteredLayout maxWidth="6xl">
					<div className="mb-8">
						<ProfileEditClient
							entity={{ type: "user", data: user }}
							saveUrl={API_ME_USER}
							followCounts={followCounts}
						/>
					</div>

					<ProfileCollectionSection
						items={collectionItems}
						pinScope={{ userId: user.id }}
						prependCards={aboutCard ? [aboutCard] : []}
						title="History"
						emptyMessage="There's nothing here yet."
						showCreateLinks={false}
					/>
				</CenteredLayout>
			);
		}

		return (
			<CenteredLayout maxWidth="6xl">
				<div className="flex flex-col gap-6 mb-8">
					<ProfileIdentityBlock profile={profile} />
					<ProfileBody profile={profile} followCounts={followCounts} />
				</div>

				<ProfileCollectionSection
					items={collectionItems}
					pinScope={{ userId: user.id }}
					prependCards={aboutCard ? [aboutCard] : []}
					title="History"
					emptyMessage="There's nothing here yet."
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

		const pageProfile: ProfileEntity = { type: "PAGE", data: page };
		const membership = await getMembershipStatus(viewerId, page.id);

		// Visibility gate: FULL renders the profile; LOCKED shows the identity-only private stub.
		const access = await resolveProfileAccess("PAGE", page, viewer);
		if (access === "LOCKED") return <LockedProfilePreview profile={pageProfile} membership={membership} />;

		// Admins get the edit chrome. Pin permission is stamped on each item by the collection query.
		const isOwner = viewerId ? await canManagePage(viewerId, page.id) : false;

		const [events, posts, followCounts] = await Promise.all([
			getEventsByPage(page.id, { includeDrafts: isOwner, viewer }),
			getPostsByPage(page.id, { includeDrafts: isOwner, viewer }),
			getFollowCounts({ type: "PAGE", id: page.id }),
		]);
		const collectionItems = [...events, ...posts];
		const displayName = getPageDisplayName(page);

		const pageAboutCard: AboutCollectionItem | null = page.aboutContent
			? {
				type: "about",
				handle: page.handle,
				displayName,
				excerpt: truncateText(page.aboutContent.replace(/[#*_`>\[\]]/g, ""), 200),
			}
			: null;

		if (isOwner) {
			return (
				<CenteredLayout maxWidth="6xl">
					<div className="mb-8">
						<ProfileEditClient
							entity={{ type: "page", data: page }}
							saveUrl={API_PAGE(page.id)}
							followCounts={followCounts}
							membership={membership}
						/>
					</div>

					<ProfileCollectionSection
						items={collectionItems}
						pinScope={{ pageId: page.id }}
						prependCards={pageAboutCard ? [pageAboutCard] : []}
						title={`${displayName}'s Collection`}
						emptyMessage="There's nothing here yet."
						showCreateLinks={false}
					/>
				</CenteredLayout>
			);
		}

		return (
			<CenteredLayout maxWidth="6xl">
				<div className="flex flex-col gap-6 mb-8">
					<ProfileIdentityBlock profile={pageProfile} membership={membership} />
					<ProfileBody profile={pageProfile} followCounts={followCounts} />
				</div>

				<ProfileCollectionSection
					items={collectionItems}
					pinScope={{ pageId: page.id }}
					prependCards={pageAboutCard ? [pageAboutCard] : []}
					title={`${displayName}'s Collection`}
					emptyMessage="There's nothing here yet."
					showCreateLinks={false}
				/>
			</CenteredLayout>
		);
	}

	// Structurally impossible: a Handle row must have either userId or pageId.
	// Belt-and-suspenders 404 in case of data corruption.
	notFound();
}
