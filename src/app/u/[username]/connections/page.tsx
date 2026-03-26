import { getUserByUsername } from "@/lib/utils/server/user";
import { getPagesForUser } from "@/lib/utils/server/permission";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ConnectionsPageView } from "@/lib/components/profile/ConnectionsPageView";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { PUBLIC_USER_PAGE } from "@/lib/const/routes";
import { getUserDisplayName } from "@/lib/types/user";

type Props = {
	params: Promise<{ username: string }>;
};

export default async function UserConnectionsPage({ params }: Props) {
	const { username } = await params;
	const user = await getUserByUsername(username);

	if (!user) {
		notFound();
	}

	const displayName = getUserDisplayName(user);
	const pages = await getPagesForUser(user.id);

	return (
		<CenteredLayout maxWidth="4xl">
			<div className="mb-6">
				<Link
					href={PUBLIC_USER_PAGE(username)}
					className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
				>
					&larr; Back to {displayName}&apos;s profile
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
				pages={pages.map((p) => ({
					id: p.id,
					slug: p.slug,
					name: p.name,
					avatarImageId: p.avatarImageId ?? null,
				}))}
			/>
		</CenteredLayout>
	);
}
