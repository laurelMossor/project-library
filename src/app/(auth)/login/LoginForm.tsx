"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { SIGNUP, HOME, FORGOT_PASSWORD } from "@/lib/const/routes";
import { InviteCTA } from "../signup/page";
import { ResendVerification } from "@/lib/components/auth/ResendVerification";
import Link from "next/link";

/**
 * The login form. Rendered only for logged-out visitors — the server component
 * (page.tsx) redirects an already-authenticated session away before this mounts, so
 * there's no "Logged in as X" banner here (its old version keyed on session truthiness
 * and could show for an invalidated, id-less session).
 */
export function LoginForm() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [unverified, setUnverified] = useState(false);
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") || HOME;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setUnverified(false);

		const result = await signIn("credentials", {
			email,
			password,
			redirect: false,
		});

		if (result?.error) {
			// `code` is set by EmailNotVerifiedError in lib/auth.ts. When present,
			// show a targeted message; otherwise the generic credentials error.
			if (result.code === "email_not_verified") {
				setUnverified(true);
				setError("Please verify your email before logging in.");
			} else {
				setError("Invalid email or password");
			}
		} else {
			// Force a full page reload to refresh all server components (layout, etc.)
			// This ensures the layout updates to show authenticated state
			window.location.href = callbackUrl;
		}
	};

	return (
		<AuthCard>
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Log In</h1>

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
					Log In
				</Button>

				<p className="text-sm text-center">
					<Link href={FORGOT_PASSWORD} className="underline">Forgot password?</Link>
				</p>

				<p className="text-sm text-center">
					Don&apos;t have an account?{" "}
					<a href={SIGNUP} className="underline">Sign up</a>
				</p>
			</form>

			{unverified && (
				<div className="space-y-2 border border-soft-grey rounded-lg p-4 bg-white/70 text-left">
					<p className="text-sm text-warm-grey">
						Need a new verification link?
					</p>
					<ResendVerification initialEmail={email} />
				</div>
			)}

			<InviteCTA />
		</AuthCard>
	);
}
