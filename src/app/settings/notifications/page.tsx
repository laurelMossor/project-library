import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
import { LOGIN_WITH_CALLBACK, NOTIFICATIONS_SETTINGS } from "@/lib/const/routes";

export default async function NotificationSettingsPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(NOTIFICATIONS_SETTINGS));
	}

	return (
		<CenteredLayout maxWidth="sm">
			<NotificationSettingsForm />
		</CenteredLayout>
	);
}
