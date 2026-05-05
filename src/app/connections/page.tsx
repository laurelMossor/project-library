import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ConnectionsPageClient } from "@/lib/components/profile/ConnectionsPageClient";
import { LOGIN_WITH_CALLBACK, CONNECTIONS } from "@/lib/const/routes";

export default async function ConnectionsPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(CONNECTIONS));
	}

	return (
		<CenteredLayout maxWidth="4xl">
			<ConnectionsPageClient />
		</CenteredLayout>
	);
}
