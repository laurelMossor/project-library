import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EXPLORE_PAGE, LOGIN_WITH_CALLBACK, SETUP } from "@/lib/const/routes";
import { SetupClient } from "./SetupClient";

function safeNext(next: string | undefined) {
	if (next && next.startsWith("/") && !next.startsWith("//")) return next;
	return EXPLORE_PAGE;
}

export default async function SetupPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string }>;
}) {
	const session = await auth();
	if (!session?.user?.id) redirect(LOGIN_WITH_CALLBACK(SETUP));

	const { next } = await searchParams;
	const destination = safeNext(next);
	// A finished user revisiting /setup goes on. A page lands here right after creation.
	if (!session.user.needsSetup && !session.user.activePageId) redirect(destination);

	return <SetupClient next={destination} />;
}
