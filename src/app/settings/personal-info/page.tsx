import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { Breadcrumb } from "@/lib/components/layout/Breadcrumb";
import { PersonalInfoForm } from "./PersonalInfoForm";
import { LOGIN_WITH_CALLBACK, PERSONAL_INFO, SETTINGS } from "@/lib/const/routes";

export default async function PersonalInfoPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PERSONAL_INFO));
	}

	return (
		<CenteredLayout maxWidth="sm" breadcrumb={<Breadcrumb href={SETTINGS} label="Back to Settings" />}>
			<PersonalInfoForm />
		</CenteredLayout>
	);
}
