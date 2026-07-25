import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EXPLORE_PAGE } from "@/lib/const/routes";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { LoginForm } from "./LoginForm";

/**
 * Server gate: an already-authenticated visitor is redirected off /login (to their
 * requested callbackUrl, else Explore) — mirroring the reverse gate on protected routes
 * like /connections. Gated on `session.user?.id`, not truthiness, so a stale/invalidated
 * session (which carries no id) still sees the form rather than being wrongly bounced.
 */
export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ callbackUrl?: string }>;
}) {
	const session = await auth();
	if (session?.user?.id) {
		const { callbackUrl } = await searchParams;
		redirect(callbackUrl || EXPLORE_PAGE);
	}

	return (
		<Suspense
			fallback={
				<AuthCard>
					<p className="text-gray-600">Loading…</p>
				</AuthCard>
			}
		>
			<LoginForm />
		</Suspense>
	);
}
