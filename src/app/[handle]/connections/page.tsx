/**
 * UNIFIED CONNECTIONS — /[handle]/connections (gated)
 *
 * Replaces all four legacy connection routes:
 *   - /u/[username]/connections (public user view)
 *   - /u/profile/connections    (owner user view)
 *   - /p/[slug]/connections     (public page view)
 *   - /p/profile/connections    (admin page view)
 *
 * Behavior change (intentional, per PR 2): the public-viewer paths from
 * the legacy `/u/.../connections` and `/p/.../connections` routes are
 * removed. Only the entity's manager (the user themselves, or an
 * ADMIN/EDITOR of the page) can view this page now. Non-managers — and
 * anonymous viewers — get a 404. If the product later wants public
 * connection lists back, add a separate `/[handle]/connections/public`
 * route or relax the gate here.
 *
 * Dispatch mirrors `[handle]/page.tsx`:
 *   1. `findEntityByHandle` resolves type or 404s.
 *   2. `canManageEntity` gates rendering or 404s.
 *   3. Branch-specific re-fetch + render.
 *      - USER branch: ConnectionsPageView (user + their managed pages).
 *      - PAGE branch: ConnectionsView (page-scoped followers/following).
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { findEntityByHandle } from "@/lib/utils/server/handle";
import { canManageEntity } from "@/lib/utils/server/permission";
import { getUserById } from "@/lib/utils/server/user";
import { getPageByHandle } from "@/lib/utils/server/page";
import { getPagesForUser } from "@/lib/utils/server/permission";
import { ConnectionsPageView } from "@/lib/components/profile/ConnectionsPageView";
import { ConnectionsView } from "@/lib/components/profile/ConnectionsView";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { getUserDisplayName } from "@/lib/types/user";
import { getPageDisplayName } from "@/lib/types/page";

type Props = {
	params: Promise<{ handle: string }>;
};

export default async function HandleConnectionsPage({ params }: Props) {
	const { handle } = await params;

	const entity = await findEntityByHandle(handle);
	if (!entity) {
		notFound();
	}

	const session = await auth();
	const viewerId = session?.user?.id;
	if (!viewerId) {
		notFound();
	}

	const allowed = await canManageEntity(viewerId, entity);
	if (!allowed) {
		notFound();
	}

	// USER branch — viewer is the user themselves (canManageEntity true).
	if (entity.user) {
		const user = await getUserById(entity.user.id);
		if (!user) {
			notFound();
		}

		const allPages = await getPagesForUser(user.id);
		const managedPages = allPages.filter(
			(p) => p.role === "ADMIN" || p.role === "EDITOR",
		);
		const displayName = getUserDisplayName(user);

		return (
			<CenteredLayout maxWidth="4xl">
				<div className="mb-6">
					<Link
						href={`/${handle}`}
						className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
					>
						&larr; Back to {displayName}&apos;s profile
					</Link>
					<h1 className="text-2xl font-bold mt-2">
						{displayName}&apos;s Connections
					</h1>
				</div>
			<ConnectionsPageView
				user={{
					id: user.id,
					handle: user.handle,
					displayName: user.displayName ?? null,
					firstName: user.firstName ?? null,
					lastName: user.lastName ?? null,
					avatarImageId: user.avatarImageId ?? null,
					avatarImage: user.avatarImage ?? null,
				}}
				pages={managedPages.map((p) => ({
					id: p.id,
					handle: p.handle,
					name: p.name,
					avatarImageId: p.avatarImageId ?? null,
					avatarImage: p.avatarImage ?? null,
					role: p.role,
				}))}
			/>
			</CenteredLayout>
		);
	}

	// PAGE branch — viewer is ADMIN or EDITOR (canManageEntity true).
	if (entity.page) {
		const page = await getPageByHandle(handle);
		if (!page) {
			notFound();
		}

		const displayName = getPageDisplayName(page);

		return (
			<CenteredLayout maxWidth="4xl">
				<div className="mb-6">
					<Link
						href={`/${handle}`}
						className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
					>
						&larr; Back to {displayName}&apos;s profile
					</Link>
					<h1 className="text-2xl font-bold mt-2">
						{displayName}&apos;s Connections
					</h1>
				</div>
				<ConnectionsView entityId={page.id} entityType="page" />
			</CenteredLayout>
		);
	}

	// Structurally impossible (Handle has mutually-exclusive userId/pageId FKs).
	notFound();
}
