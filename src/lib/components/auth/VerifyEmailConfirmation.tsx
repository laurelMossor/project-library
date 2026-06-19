"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/lib/components/ui/Button";
import { FormError } from "@/lib/components/forms/FormError";
import { ResendVerification } from "./ResendVerification";
import { API_AUTH_VERIFY_EMAIL, LOGIN } from "@/lib/const/routes";

type Status = "ready" | "confirming" | "verified" | "error";

/**
 * Click-to-confirm email verification. The token is consumed only on this
 * deliberate POST (not on page load), so email scanners that GET the link can't
 * burn it. On failure, offers a resend so the user is never stuck.
 */
export function VerifyEmailConfirmation({ token }: { token: string }) {
	const [status, setStatus] = useState<Status>("ready");
	const [error, setError] = useState("");

	const handleConfirm = async () => {
		setStatus("confirming");
		setError("");
		try {
			const res = await fetch(API_AUTH_VERIFY_EMAIL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token }),
			});
			if (res.ok) {
				setStatus("verified");
				return;
			}
			const data = await res.json().catch(() => ({}));
			setError(data.error || "This verification link is invalid or has expired.");
			setStatus("error");
		} catch {
			setError("Something went wrong. Please try again.");
			setStatus("error");
		}
	};

	if (status === "verified") {
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

	if (status === "error") {
		return (
			<>
				<h1 className="text-2xl font-bold">Verification failed</h1>
				<FormError error={error} />
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
			<Button
				onClick={handleConfirm}
				fullWidth
				disabled={status === "confirming"}
			>
				{status === "confirming" ? "Confirming…" : "Confirm my email"}
			</Button>
		</>
	);
}
