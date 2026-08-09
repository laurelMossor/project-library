import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileSettingsClient } from "./ProfileSettingsClient";
import { LOGIN_WITH_CALLBACK, PROFILE_SETTINGS } from "@/lib/const/routes";

export default async function ProfileSettingsPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PROFILE_SETTINGS));
	}

	return (
		<CenteredLayout maxWidth="lg">
			<ProfileSettingsClient />
		</CenteredLayout>
	);
}
