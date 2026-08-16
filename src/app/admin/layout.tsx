import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/utils/server/superadmin";

/**
 * Server gate for all /admin/* operator surfaces. Superadmin-only; anyone else gets a
 * 404 (existence-deny — don't reveal the surface). This is the first `admin/` route.
 * Each admin API route re-checks superadmin independently (defense-in-depth).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
	const session = await auth();
	if (!isSuperAdmin(session?.user?.id)) {
		notFound();
	}
	return <>{children}</>;
}
