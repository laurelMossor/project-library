"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/lib/components/ui/Button";
import { API_AUTH_FORGOT_PASSWORD, LOGIN } from "@/lib/const/routes";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus("sending");
		try {
			const res = await fetch(API_AUTH_FORGOT_PASSWORD, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			setStatus(res.ok ? "sent" : "error");
		} catch {
			setStatus("error");
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-4 text-center">
				<h1 className="text-2xl font-bold">Reset your password</h1>

				{status === "sent" ? (
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
						<input
							type="email"
							placeholder="Email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full border p-2 rounded"
							required
						/>
						<Button type="submit" fullWidth disabled={status === "sending"}>
							{status === "sending" ? "Sending…" : "Send reset link"}
						</Button>
						{status === "error" && (
							<p className="text-sm text-red-500">
								Something went wrong. Please try again.
							</p>
						)}
					</form>
				)}

				<p className="text-sm">
					<Link href={LOGIN} className="underline">
						Back to log in
					</Link>
				</p>
			</div>
		</main>
	);
}
