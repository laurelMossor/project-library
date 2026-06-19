import { validateAuthToken } from "@/lib/validations";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { VerifyEmailConfirmation } from "@/lib/components/auth/VerifyEmailConfirmation";
import { ResendVerification } from "@/lib/components/auth/ResendVerification";

/**
 * GET /verify-email?token=...
 *
 * Validates the token *format* and renders a click-to-confirm button. The token
 * is consumed only on the button POST (see VerifyEmailConfirmation) — never on
 * GET load — so email scanners / link prefetchers can't burn the one-time token.
 */
export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string }>;
}) {
	const { token } = await searchParams;

	if (!validateAuthToken(token)) {
		return (
			<AuthCard>
				<h1 className="text-2xl font-bold">Verification failed</h1>
				<p className="text-misty-forest">
					This verification link is invalid or has expired.
				</p>
				<p className="text-sm text-misty-forest">
					Request a fresh verification link:
				</p>
				<ResendVerification />
			</AuthCard>
		);
	}

	return (
		<AuthCard>
			<VerifyEmailConfirmation token={token} />
		</AuthCard>
	);
}
