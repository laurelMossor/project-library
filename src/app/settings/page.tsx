import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { ProfilePageView } from "@/lib/components/profile/ProfilePageView";
import { LOGIN_WITH_CALLBACK, SETTINGS } from "@/lib/const/routes";

export default async function SettingsPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(SETTINGS));
	}

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<HeadingTitle title="Settings" />
				<p className="text-gray-600">
					Manage your profile information and account settings
				</p>
			</div>
			<ProfilePageView />
		</CenteredLayout>
	);
}
