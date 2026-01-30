import { getUserByUsername } from "@/lib/utils/server/user";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ConnectionsView } from "@/lib/components/owner/ConnectionsView";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { PUBLIC_USER_PAGE } from "@/lib/const/routes";

type Props = {
	params: Promise<{ username: string }>;
};

export default async function UserConnectionsPage({ params }: Props) {
	const { username } = await params;
	const user = await getUserByUsername(username);

	if (!user) {
		notFound();
	}

	return (
		<CenteredLayout maxWidth="4xl">
			<div className="mb-6">
				<Link 
					href={PUBLIC_USER_PAGE(username)} 
					className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
				>
					← Back to {username}&apos;s profile
				</Link>
				<h1 className="text-2xl font-bold mt-2">{username}&apos;s Connections</h1>
			</div>
			<ConnectionsView ownerId={user.ownerId} />
		</CenteredLayout>
	);
}
