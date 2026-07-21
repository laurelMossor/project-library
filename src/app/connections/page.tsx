import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ConnectionsPageClient } from "@/lib/components/profile/ConnectionsPageClient";
import { LOGIN_WITH_CALLBACK, CONNECTIONS } from "@/lib/const/routes";

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

	return (
		<CenteredLayout maxWidth="4xl">
			<ConnectionsPageClient initialTab={initialTab} />
		</CenteredLayout>
	);
}
