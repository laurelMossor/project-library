import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { SettingsPageView } from "@/lib/components/profile/profile-settings/SettingsPageView";
import { LOGIN_WITH_CALLBACK, SETTINGS } from "@/lib/const/routes";

export default async function SettingsPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(SETTINGS));
	}

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">Settings</h1>
				<p className="text-gray-600">Manage your account and pages</p>
			</div>
			<SettingsPageView />
		</CenteredLayout>
	);
}
