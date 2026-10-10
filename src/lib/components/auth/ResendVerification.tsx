"use client";

import { useState } from "react";
import { Button } from "@/lib/components/ui/Button";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { useAction } from "@/lib/hooks/useAction";
import { resendVerificationAction } from "@/lib/actions/auth";

interface ResendVerificationProps {
	/** Pre-fill the email (e.g. from the signup flow). */
	initialEmail?: string;
}

/**
 * Email input + "Resend verification" button. The action succeeds the same way
 * whether or not the account exists (no account enumeration), so the UI shows a
 * generic confirmation either way.
 */
export function ResendVerification({ initialEmail = "" }: ResendVerificationProps) {
	const [email, setEmail] = useState(initialEmail);
	const [sent, setSent] = useState(false);
	const { run, pending, error } = useAction(resendVerificationAction);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const result = await run({ email });
		if (result.ok) setSent(true);
	};

	if (sent) {
		return (
			<p className="text-sm text-misty-forest">
				If that account needs verification, we&apos;ve sent a new link. Check
				your inbox.
			</p>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-2">
			<FormInput
				type="email"
				placeholder="Email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				required
			/>
			<Button type="submit" fullWidth disabled={pending}>
				{pending ? "Sending…" : "Resend verification email"}
			</Button>
			{error && <FormError error={error} />}
		</form>
	);
}
