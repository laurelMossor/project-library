import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { getPagesForUser } from "@/lib/utils/server/permission";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ConnectionsPageView } from "@/lib/components/profile/ConnectionsPageView";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { LOGIN_WITH_CALLBACK, PRIVATE_USER_PAGE } from "@/lib/const/routes";
import { getUserDisplayName } from "@/lib/types/user";

export default async function UserConnectionsPage() {
	const session = await auth();

	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
	}

	const userId = session.user.id;
	const [user, allPages] = await Promise.all([
		getUserById(userId),
		getPagesForUser(userId),
	]);

	if (!user) {
		redirect(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
	}

	const managedPages = allPages.filter((p) => p.role === "ADMIN" || p.role === "EDITOR");
	const displayName = getUserDisplayName(user);

	return (
		<CenteredLayout maxWidth="4xl">
			<div className="mb-6">
				<Link
					href={PRIVATE_USER_PAGE}
					className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
				>
					&larr; Back to profile
				</Link>
				<h1 className="text-2xl font-bold mt-2">{displayName}&apos;s Connections</h1>
			</div>
			<ConnectionsPageView
				user={{
					id: user.id,
					username: user.username,
					displayName: user.displayName ?? null,
					firstName: user.firstName ?? null,
					lastName: user.lastName ?? null,
					avatarImageId: user.avatarImageId ?? null,
				}}
				pages={managedPages.map((p) => ({
					id: p.id,
					slug: p.slug,
					name: p.name,
					avatarImageId: p.avatarImageId ?? null,
					role: p.role,
				}))}
			/>
		</CenteredLayout>
	);
}
