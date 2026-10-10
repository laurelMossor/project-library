"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { HandleInput } from "@/lib/components/forms/HandleInput";
import { FieldLabel } from "@/lib/components/profile/FieldLabel";
import { useNameHandlePrefill } from "@/lib/hooks/useNameHandlePrefill";
import { PasswordPair } from "@/lib/components/auth/PasswordPair";
import { ACCOUNT_INTEREST_FORM, CHECK_INBOX, LOGIN, SIGNUP_INVITE_QUERY } from "@/lib/const/routes";
import { useAction } from "@/lib/hooks/useAction";
import { signupAction } from "@/lib/actions/auth";
import { validatePasswordPair } from "@/lib/validations";
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
	const [confirm, setConfirm] = useState("");
	const [handle, setHandle] = useState("");
	const [handleAvailable, setHandleAvailable] = useState(false);
	const [displayName, setDisplayName] = useState("");
	const [formError, setError] = useState("");
	const signup = useAction(signupAction);
	const error = formError || signup.error || "";
	const prefill = useNameHandlePrefill({ setName: setDisplayName, setHandle });

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		signup.clearError();

		const pairError = validatePasswordPair(password, confirm);
		if (pairError) {
			setError(pairError);
			return;
		}

		if (!handle.trim()) {
			setError("Choose a handle — it's your profile's web address.");
			return;
		}
		if (!handleAvailable) {
			setError("Pick an available handle.");
			return;
		}

		const result = await signup.run({
			email,
			password,
			invite: inviteToken,
			handle: handle.trim().toLowerCase(),
			displayName: displayName.trim() || undefined,
		});
		if (!result.ok) return;

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
				<PasswordPair
					password={password}
					confirm={confirm}
					onPasswordChange={setPassword}
					onConfirmChange={setConfirm}
				/>
				<div>
					<FieldLabel label="Display name" htmlFor="display-name-input" optional />
					<FormInput
						id="display-name-input"
						type="text"
						placeholder="What people call you"
						value={displayName}
						onChange={(e) => {
							setDisplayName(e.target.value);
							prefill.onNameTyped(e.target.value);
						}}
						maxLength={100}
						className="mt-1"
					/>
				</div>
				<HandleInput
					value={handle}
					onChange={(next) => {
						setHandle(next);
						prefill.onHandleTyped(next);
					}}
					onAvailable={setHandleAvailable}
					variant="boxed"
				/>
				<Button type="submit" fullWidth loading={signup.pending}>
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
