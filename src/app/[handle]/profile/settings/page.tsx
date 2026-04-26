/**
 * UNIFIED PROFILE SETTINGS LIST — /[handle]/profile/settings (gated)
 *
 * Replaces /u/profile/settings and /p/profile/settings.
 *
 * Legacy versions of this URL had two distinct shapes:
 *   - /u/profile/settings: simple list of the user's managed pages with
 *     "View Page" links + Quick Links to user profile / edit profile.
 *   - /p/profile/settings: switch-profiles UI (active-page state, Switch To
 *     buttons) + same page list + Quick Links.
 *
 * In the flat URL world, "switch profile" reduces to navigation between
 * `/[handle]/...` URLs (each handle IS the active profile context for
 * its sub-pages). So the explicit switch UI is no longer needed — Links
 * to other handles' profiles do the same job.
 *
 * This unified page renders a server-side list of the viewer's managed
 * profiles (their own user + all pages they ADMIN/EDIT) with View Profile
 * + Manage links to each. Server-rendered (was client previously) since
 * we don't need any client-side state — pure navigation.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { findEntityByHandle } from "@/lib/utils/server/handle";
import { canManageEntity } from "@/lib/utils/server/permission";
import { getUserById } from "@/lib/utils/server/user";
import { getPagesForUser } from "@/lib/utils/server/permission";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { HOME } from "@/lib/const/routes";

type Props = {
	params: Promise<{ handle: string }>;
};

export default async function HandleProfileSettingsPage({ params }: Props) {
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

	const [viewer, managedPages] = await Promise.all([
		getUserById(viewerId),
		getPagesForUser(viewerId),
	]);

	const editableProfiles = managedPages.filter(
		(p) => p.role === "ADMIN" || p.role === "EDITOR",
	);

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">Settings</h1>
				<p className="text-gray-600">Manage your account and pages</p>
			</div>

			{viewer && (
				<div className="bg-white border rounded-lg p-6 mb-6">
					<h2 className="text-xl font-semibold mb-4">Your Profile</h2>
					<ProfileTag
						entity={{
							id: viewer.id,
							handle: viewer.handle,
							displayName: viewer.displayName ?? null,
							firstName: viewer.firstName ?? null,
							lastName: viewer.lastName ?? null,
							avatarImageId: viewer.avatarImageId ?? null,
							avatarImage: viewer.avatarImage ?? null,
						}}
						actions={
							<ButtonLink
								href={`/${viewer.handle}/profile`}
								variant="secondary"
								size="sm"
							>
								Manage
							</ButtonLink>
						}
					/>
				</div>
			)}

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Pages</h2>
				{editableProfiles.length === 0 ? (
					<p className="text-sm text-gray-600">
						You don&apos;t have any pages yet.
					</p>
				) : (
					<div className="space-y-2">
						{editableProfiles.map((page) => (
							<ProfileTag
								key={page.id}
								entity={{
									id: page.id,
									handle: page.handle,
									name: page.name,
									avatarImageId: page.avatarImageId,
								}}
								actions={
									<>
										<ButtonLink
											href={`/${page.handle}`}
											variant="secondary"
											size="sm"
										>
											View
										</ButtonLink>
										<ButtonLink
											href={`/${page.handle}/profile`}
											variant="secondary"
											size="sm"
										>
											Manage
										</ButtonLink>
									</>
								}
							/>
						))}
					</div>
				)}
			</div>

			<div className="flex gap-4 justify-center">
				<Link href={HOME} className="text-sm underline text-gray-600">
					Home
				</Link>
			</div>
		</CenteredLayout>
	);
}
