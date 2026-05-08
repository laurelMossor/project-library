import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { PersonalInfoForm } from "./PersonalInfoForm";
import { LOGIN_WITH_CALLBACK, PERSONAL_INFO } from "@/lib/const/routes";

export default async function PersonalInfoPage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(PERSONAL_INFO));
	}

	return (
		<CenteredLayout maxWidth="sm">
			<PersonalInfoForm />
		</CenteredLayout>
	);
}
