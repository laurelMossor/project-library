"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/lib/components/ui/Button";
import { FormError } from "@/lib/components/forms/FormError";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { PasswordPair } from "@/lib/components/auth/PasswordPair";
import {
	API_AUTH_RESET_PASSWORD,
	FORGOT_PASSWORD,
	LOGIN,
	RESET_PASSWORD_TOKEN_QUERY,
} from "@/lib/const/routes";
import { validatePasswordPair } from "@/lib/validations";

function ResetPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get(RESET_PASSWORD_TOKEN_QUERY)?.trim() ?? "";

	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const pairError = validatePasswordPair(password, confirm);
		if (pairError) {
			setError(pairError);
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch(API_AUTH_RESET_PASSWORD, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Failed to reset password");
				setSubmitting(false);
				return;
			}
			router.push(`${LOGIN}?reset=1`);
		} catch {
			setError("Something went wrong. Please try again.");
			setSubmitting(false);
		}
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
