import { getOrgBySlug } from "@/lib/utils/server/org";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ConnectionsView } from "@/lib/components/owner/ConnectionsView";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { PUBLIC_ORG_PAGE } from "@/lib/const/routes";

type Props = {
	params: Promise<{ slug: string }>;
};

export default async function OrgConnectionsPage({ params }: Props) {
	const { slug } = await params;
	const org = await getOrgBySlug(slug);

	if (!org) {
		notFound();
	}

	return (
		<CenteredLayout maxWidth="4xl">
			<div className="mb-6">
				<Link 
					href={PUBLIC_ORG_PAGE(slug)} 
					className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
				>
					← Back to {org.name}&apos;s profile
				</Link>
				<h1 className="text-2xl font-bold mt-2">{org.name}&apos;s Connections</h1>
			</div>
			<ConnectionsView ownerId={org.ownerId} />
		</CenteredLayout>
	);
}
