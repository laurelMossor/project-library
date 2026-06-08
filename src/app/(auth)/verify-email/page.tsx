import Link from "next/link";
import { consumeEmailVerificationToken } from "@/lib/utils/server/auth-tokens";
import { validateAuthToken } from "@/lib/validations";
import { LOGIN } from "@/lib/const/routes";
import { ResendVerification } from "@/lib/components/auth/ResendVerification";

/**
 * GET /verify-email?token=...
 *
 * Consumes the verification token server-side on load and shows the result.
 * On failure, offers a resend so the user is never stuck.
 */
export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string }>;
}) {
	const { token } = await searchParams;
	const valid = validateAuthToken(token);
	const result = valid
		? await consumeEmailVerificationToken(token)
		: ({ ok: false, error: "This verification link is invalid or has expired." } as const);

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-4 text-center">
				{result.ok ? (
					<>
						<h1 className="text-2xl font-bold">Email verified</h1>
						<p className="text-misty-forest">
							Your email is confirmed. You can now log in.
						</p>
						<Link href={LOGIN} className="underline">
							Go to log in
						</Link>
					</>
				) : (
					<>
						<h1 className="text-2xl font-bold">Verification failed</h1>
						<p className="text-misty-forest">{result.error}</p>
						<p className="text-sm text-misty-forest">
							Request a fresh verification link:
						</p>
						<ResendVerification />
					</>
				)}
			</div>
		</main>
	);
}
