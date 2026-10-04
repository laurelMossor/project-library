import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfilePageView } from "@/lib/components/profile/ProfilePageView";
import { LOGIN_WITH_CALLBACK, SETTINGS } from "@/lib/const/routes";

export default async function SettingsPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(SETTINGS));
	}

	return (
		<CenteredLayout maxWidth="2xl">
			<ProfilePageView />
		</CenteredLayout>
	);
}
