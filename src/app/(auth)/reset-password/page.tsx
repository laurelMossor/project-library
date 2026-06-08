"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/lib/components/ui/Button";
import {
	API_AUTH_RESET_PASSWORD,
	FORGOT_PASSWORD,
	LOGIN,
	RESET_PASSWORD_TOKEN_QUERY,
} from "@/lib/const/routes";

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

		if (password.length < 8) {
			setError("Password must be at least 8 characters long");
			return;
		}
		if (password !== confirm) {
			setError("Passwords don't match");
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
			<main className="flex min-h-screen items-center justify-center p-4">
				<div className="w-full max-w-sm space-y-4 text-center">
					<h1 className="text-2xl font-bold">Invalid reset link</h1>
					<p className="text-misty-forest">
						This link is missing its token. Request a new one.
					</p>
					<Link href={FORGOT_PASSWORD} className="underline">
						Request a reset link
					</Link>
				</div>
			</main>
		);
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
				<h1 className="text-2xl font-bold">Choose a new password</h1>

				{error && <p className="text-red-500">{error}</p>}

				<input
					type="password"
					placeholder="New password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					className="w-full border p-2 rounded"
					required
				/>
				<input
					type="password"
					placeholder="Confirm new password"
					value={confirm}
					onChange={(e) => setConfirm(e.target.value)}
					className="w-full border p-2 rounded"
					required
				/>
				<Button type="submit" fullWidth disabled={submitting}>
					{submitting ? "Saving…" : "Reset password"}
				</Button>
			</form>
		</main>
	);
}

export default function ResetPasswordPage() {
	return (
		<Suspense
			fallback={
				<main className="flex min-h-screen items-center justify-center p-4">
					<p className="text-gray-600">Loading…</p>
				</main>
			}
		>
			<ResetPasswordForm />
		</Suspense>
	);
}
