"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/lib/components/ui/Button";
import { FormError } from "@/lib/components/forms/FormError";
import { ResendVerification } from "./ResendVerification";
import { LOGIN } from "@/lib/const/routes";
import { useAction } from "@/lib/hooks/useAction";
import { verifyEmailAction } from "@/lib/actions/auth";

/**
 * Click-to-confirm email verification. The token is consumed only on this
 * deliberate click (not on page load), so email scanners that GET the link can't
 * burn it. On failure, offers a resend so the user is never stuck.
 */
export function VerifyEmailConfirmation({ token }: { token: string }) {
	const [outcome, setOutcome] = useState<"verified" | "failed" | null>(null);
	const { run, pending, error } = useAction(verifyEmailAction);

	const handleConfirm = async () => {
		const result = await run({ token });
		setOutcome(result.ok ? "verified" : "failed");
	};

	if (outcome === "verified") {
		return (
			<>
				<h1 className="text-2xl font-bold">Email verified</h1>
				<p className="text-misty-forest">
					Your email is confirmed. You can now log in.
				</p>
				<Link href={LOGIN} className="underline">
					Go to log in
				</Link>
			</>
		);
	}

	if (outcome === "failed") {
		return (
			<>
				<h1 className="text-2xl font-bold">Verification failed</h1>
				<FormError error={error ?? "This verification link is invalid or has expired."} />
				<p className="text-sm text-misty-forest">
					Request a fresh verification link:
				</p>
				<ResendVerification />
			</>
		);
	}

	return (
		<>
			<h1 className="text-2xl font-bold">Confirm your email</h1>
			<p className="text-misty-forest">
				Click below to verify your email and activate your account.
			</p>
			<Button onClick={handleConfirm} fullWidth disabled={pending}>
				{pending ? "Confirming…" : "Confirm my email"}
			</Button>
		</>
	);
}
