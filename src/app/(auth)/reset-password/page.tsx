"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/lib/components/ui/Button";
import { FormError } from "@/lib/components/forms/FormError";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { PasswordPair } from "@/lib/components/auth/PasswordPair";
import { FORGOT_PASSWORD, LOGIN, RESET_PASSWORD_TOKEN_QUERY } from "@/lib/const/routes";
import { validatePasswordPair } from "@/lib/validations";
import { useAction } from "@/lib/hooks/useAction";
import { resetPasswordAction } from "@/lib/actions/auth";

function ResetPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get(RESET_PASSWORD_TOKEN_QUERY)?.trim() ?? "";

	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [formError, setError] = useState("");
	// Stays set once the reset lands, so the button can't resubmit the spent token while navigating.
	const [done, setDone] = useState(false);
	const reset = useAction(resetPasswordAction);
	const error = formError || reset.error || "";
	const submitting = reset.pending || done;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		reset.clearError();

		const pairError = validatePasswordPair(password, confirm);
		if (pairError) {
			setError(pairError);
			return;
		}

		const result = await reset.run({ token, password });
		if (!result.ok) return;
		setDone(true);
		router.push(`${LOGIN}?reset=1`);
	};

	if (!token) {
		return (
			<AuthCard>
				<h1 className="text-2xl font-bold">Invalid reset link</h1>
				<p className="text-misty-forest">
					This link is missing its token. Request a new one.
				</p>
				<Link href={FORGOT_PASSWORD} className="underline">
					Request a reset link
				</Link>
			</AuthCard>
		);
	}

	return (
		<AuthCard>
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Choose a new password</h1>

				<FormError error={error} />

				<PasswordPair
					password={password}
					confirm={confirm}
					onPasswordChange={setPassword}
					onConfirmChange={setConfirm}
					passwordPlaceholder="New password"
					confirmPlaceholder="Confirm new password"
				/>
				<Button type="submit" fullWidth disabled={submitting}>
					{submitting ? "Saving…" : "Reset password"}
				</Button>
			</form>
		</AuthCard>
	);
}

export default function ResetPasswordPage() {
	return (
		<Suspense
			fallback={
				<AuthCard>
					<p className="text-gray-600">Loading…</p>
				</AuthCard>
			}
		>
			<ResetPasswordForm />
		</Suspense>
	);
}
