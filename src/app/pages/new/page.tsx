import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LOGIN_WITH_CALLBACK, PAGE_NEW } from "@/lib/const/routes";
import { createCuid } from "@/lib/utils/cuid";
import { PageCreateClient } from "./PageCreateClient";

export default async function NewPagePage() {
	const session = await auth();
	if (!session?.user?.id) redirect(LOGIN_WITH_CALLBACK(PAGE_NEW));
	// Chosen here so the avatar preview and the row created on confirm share one id.
	return <PageCreateClient id={createCuid()} />;
}
