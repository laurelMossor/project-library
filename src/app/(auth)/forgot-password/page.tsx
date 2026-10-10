"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/lib/components/ui/Button";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { LOGIN } from "@/lib/const/routes";
import { useAction } from "@/lib/hooks/useAction";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const { run, pending, error } = useAction(requestPasswordResetAction);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const result = await run({ email });
		if (result.ok) setSent(true);
	};

	return (
		<AuthCard>
			<h1 className="text-2xl font-bold">Reset your password</h1>

			{sent ? (
				<p className="text-misty-forest">
					If an account exists for that email, we&apos;ve sent a reset link.
					Check your inbox.
				</p>
			) : (
				<form onSubmit={handleSubmit} className="space-y-4">
					<p className="text-sm text-misty-forest">
						Enter your email and we&apos;ll send you a link to choose a new
						password.
					</p>
					<FormInput
						type="email"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
					<Button type="submit" fullWidth disabled={pending}>
						{pending ? "Sending…" : "Send reset link"}
					</Button>
					{error && <FormError error={error} />}
				</form>
			)}

			<p className="text-sm">
				<Link href={LOGIN} className="underline">
					Back to log in
				</Link>
			</p>
		</AuthCard>
	);
}
