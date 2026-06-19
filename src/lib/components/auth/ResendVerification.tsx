"use client";

import { useState } from "react";
import { Button } from "@/lib/components/ui/Button";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { API_AUTH_RESEND_VERIFICATION } from "@/lib/const/routes";

interface ResendVerificationProps {
	/** Pre-fill the email (e.g. from the signup flow). */
	initialEmail?: string;
}

/**
 * Email input + "Resend verification" button. Posts to the resend endpoint,
 * which always responds neutrally (no account enumeration), so the UI shows a
 * generic confirmation regardless of whether the account existed.
 */
export function ResendVerification({ initialEmail = "" }: ResendVerificationProps) {
	const [email, setEmail] = useState(initialEmail);
	const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus("sending");
		try {
			const res = await fetch(API_AUTH_RESEND_VERIFICATION, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			setStatus(res.ok ? "sent" : "error");
		} catch {
			setStatus("error");
		}
	};

	if (status === "sent") {
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
			<Button type="submit" fullWidth disabled={status === "sending"}>
				{status === "sending" ? "Sending…" : "Resend verification email"}
			</Button>
			{status === "error" && (
				<FormError error="Something went wrong. Please try again." />
			)}
		</form>
	);
}
