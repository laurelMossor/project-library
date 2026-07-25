import { ReactNode } from "react";

/**
 * Centered narrow-card shell shared by every page in the (auth) route group
 * (login, signup, forgot/reset password, verify email). Replaces the
 * hand-rolled `<main class="flex min-h-screen items-center justify-center …">`
 * each page used to repeat. Not CenteredLayout — that one is top-aligned.
 */
export function AuthCard({ children }: { children: ReactNode }) {
	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-4 text-center">{children}</div>
		</main>
	);
}
