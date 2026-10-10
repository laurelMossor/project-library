import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { Breadcrumb } from "@/lib/components/layout/Breadcrumb";
import { ConnectionsPageClient } from "@/lib/components/profile/ConnectionsPageClient";
import { getActingIdentity } from "@/lib/utils/server/session";
import { getConnectionsData } from "@/lib/utils/server/connections";
import { LOGIN_WITH_CALLBACK, CONNECTIONS, SETTINGS } from "@/lib/const/routes";

export default async function ConnectionsPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(CONNECTIONS));
	}

	// Read the deep-link tab server-side (?tab=Requests from a notification) — no useSearchParams,
	// so no Suspense boundary needed.
	const sp = await searchParams;
	const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;

	// The screen belongs to the identity the viewer is acting as: a page they act as, else themselves.
	// getActingIdentity re-checks the page role, so a stale activePageId falls back to personal.
	const { currentUser, activePage } = await getActingIdentity(session);
	if (!currentUser) redirect(LOGIN_WITH_CALLBACK(CONNECTIONS));
	const entity = activePage ?? currentUser;
	const data = await getConnectionsData(
		currentUser.id,
		activePage ? { type: "PAGE", id: activePage.id } : { type: "USER", id: currentUser.id },
	);

	return (
		<CenteredLayout maxWidth="4xl" breadcrumb={<Breadcrumb href={SETTINGS} label="Back to Settings" />}>
			<ConnectionsPageClient entity={entity} currentUserId={currentUser.id} data={data} initialTab={initialTab} />
		</CenteredLayout>
	);
}
