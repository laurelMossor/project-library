/**
 * UNIFIED PROFILE SETTINGS — /[handle]/profile (gated)
 *
 * Replaces /u/profile and /p/profile. Renders the entity's profile-settings
 * panel via the appropriate sibling component (UserSettingsContent or
 * PageSettingsContent).
 *
 * Gate: `canManageEntity` — anonymous viewers and non-managers get 404.
 * No login redirect (the URL itself was meant to be private and PR 2's
 * Task 17 smoke-test explicitly says "/<handle>/profile while logged out
 * → notFound()"). Privacy-preserving: no leak about whether the entity
 * exists.
 *
 * The "additional settings buttons" hrefs are computed here from the
 * `[handle]` segment so the client components don't need to know about
 * route construction. After Task 11, these will use `MANAGE_CONNECTIONS`
 * and `PUBLIC_PROFILE` constants.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { findEntityByHandle } from "@/lib/utils/server/handle";
import { canManageEntity } from "@/lib/utils/server/permission";
import { getUserById } from "@/lib/utils/server/user";
import { getPageByHandle } from "@/lib/utils/server/page";
import { getPagesForUser } from "@/lib/utils/server/permission";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { HOME, COLLECTIONS } from "@/lib/const/routes";
import { UserSettingsContent } from "./UserSettingsContent";
import { PageSettingsContent } from "./PageSettingsContent";

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
	if (!viewerId) {
		notFound();
	}

	const allowed = await canManageEntity(viewerId, entity);
	if (!allowed) {
		notFound();
	}

	// User branch — viewer is the user themselves.
	if (entity.user) {
		const [user, pages] = await Promise.all([
			getUserById(entity.user.id),
			getPagesForUser(viewerId),
		]);
		if (!user) {
			notFound();
		}

		return (
			<CenteredLayout maxWidth="2xl">
				<div className="mb-8">
					<HeadingTitle title="Profile Settings" />
					<p className="text-gray-600">
						Manage your profile information and account settings
					</p>
				</div>

				<UserSettingsContent
					user={user}
					pages={pages}
					publicProfileHref={`/${handle}`}
					connectionsHref={`/${handle}/connections`}
				/>

				<div className="flex gap-4 justify-center">
					<Link href={HOME} className="text-sm underline text-gray-600">
						Home
					</Link>
					<Link href={COLLECTIONS} className="text-sm underline text-gray-600">
						Collections
					</Link>
				</div>
			</CenteredLayout>
		);
	}

	// Page branch — viewer is ADMIN/EDITOR.
	if (entity.page) {
		const [page, pages] = await Promise.all([
			getPageByHandle(handle),
			getPagesForUser(viewerId),
		]);
		if (!page) {
			notFound();
		}

		return (
			<CenteredLayout maxWidth="2xl">
				<div className="mb-8">
					<HeadingTitle title="Page Profile" />
					<p className="text-gray-600">
						Manage {page.name}&apos;s profile information and settings
					</p>
				</div>

				<PageSettingsContent
					page={page}
					pages={pages}
					publicProfileHref={`/${handle}`}
					connectionsHref={`/${handle}/connections`}
				/>

				<div className="flex gap-4 justify-center">
					<Link href={HOME} className="text-sm underline text-gray-600">
						Home
					</Link>
					<Link href={COLLECTIONS} className="text-sm underline text-gray-600">
						Collections
					</Link>
				</div>
			</CenteredLayout>
		);
	}

	notFound();
}
