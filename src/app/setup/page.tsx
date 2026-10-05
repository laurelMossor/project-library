import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EXPLORE_PAGE, LOGIN_WITH_CALLBACK, SETUP } from "@/lib/const/routes";
import { safeNext } from "@/lib/utils/safe-next";
import { SetupClient } from "./SetupClient";

export default async function SetupPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect(LOGIN_WITH_CALLBACK(SETUP));

	const { next } = await searchParams;
	const destination = safeNext(next, EXPLORE_PAGE);
	// A finished user revisiting /setup goes on.
	if (!session.user.needsSetup) redirect(destination);

	return <SetupClient next={destination} />;
}
