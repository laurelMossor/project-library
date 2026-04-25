import { getPageByHandle } from "@/lib/utils/server/page";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ConnectionsView } from "@/lib/components/profile/ConnectionsView";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { PUBLIC_PAGE } from "@/lib/const/routes";
import { getPageDisplayName } from "@/lib/types/page";

type Props = {
	params: Promise<{ slug: string }>;
};

export default async function PageConnectionsPage({ params }: Props) {
	const { slug } = await params;
	const page = await getPageByHandle(slug);

	if (!page) {
		notFound();
	}

	const displayName = getPageDisplayName(page);

	return (
		<CenteredLayout maxWidth="4xl">
			<div className="mb-6">
				<Link
					href={PUBLIC_PAGE(slug)}
					className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
				>
					&larr; Back to {displayName}&apos;s profile
				</Link>
				<h1 className="text-2xl font-bold mt-2">{displayName}&apos;s Connections</h1>
			</div>
			<ConnectionsView entityId={page.id} entityType="page" />
		</CenteredLayout>
	);
}
