"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { ACCOUNT_INTEREST_FORM, API_AUTH_SIGNUP, CHECK_INBOX, LOGIN, SIGNUP_INVITE_QUERY } from "@/lib/const/routes";
import Link from "next/link";

export const InviteCTA = () => {
	return (
		<div className="py-4 px-4 border border-soft-grey rounded-lg bg-white/70">
			<p className="text-sm text-warm-grey pb-3">The Project Library is in early beta — things are still being built and we&apos;re not yet open to the public. Interested in an invite or becoming a beta tester? <span className="font-bold text-rich-brown">Fill out this form!</span></p>
			<Link href={ACCOUNT_INTEREST_FORM} className="text-sm text-whale-blue underline">Interest Form</Link>
		</div>
	);
};

function SignupForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const inviteToken = searchParams.get(SIGNUP_INVITE_QUERY)?.trim() ?? "";

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		// No handle field — one is auto-generated server-side from the email; users can
		// personalize it later in Settings.
		const res = await fetch(API_AUTH_SIGNUP, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email,
				password,
				invite: inviteToken,
			}),
		});

		if (!res.ok) {
			const data = await res.json();
			setError(data.error || "Signup failed");
			return;
		}

		// Account created but unverified — send them to verify their email.
		router.push(`${CHECK_INBOX}?email=${encodeURIComponent(email)}`);
	};

	if (!inviteToken) {
		return (
			<AuthCard>
				<h1 className="text-2xl font-bold">Sign up</h1>
				<p>
					Sign up is by <span className="font-bold">invitation only</span>. Open
					the link from your invitation email to continue.
				</p>
				<p>
					Already have an account?{" "}
					<a href={LOGIN} className="underline">
						Log in
					</a>
				</p>
				<InviteCTA />
			</AuthCard>
		);
	}

	return (
		<AuthCard>
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Sign Up</h1>

				<FormError error={error} />

				<FormInput
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
				<FormInput
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
				<Button type="submit" fullWidth>
					Sign Up
				</Button>

				<p className="text-sm text-center">
					Already have an account?{" "}
					<a href={LOGIN} className="underline">
						Log in
					</a>
				</p>
			</form>
		</AuthCard>
	);
}

export default function SignupPage() {
	return (
		<Suspense
			fallback={
				<AuthCard>
					<p className="text-gray-600">Loading…</p>
				</AuthCard>
			}
		>
			<SignupForm />
		</Suspense>
	);
}
