"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { API_AUTH_SIGNUP, LOGIN, SIGNUP_INVITE_QUERY } from "@/lib/const/routes";

function SignupForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const inviteToken = searchParams.get(SIGNUP_INVITE_QUERY)?.trim() ?? "";

	const [email, setEmail] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const res = await fetch(API_AUTH_SIGNUP, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email,
				username,
				password,
				invite: inviteToken,
			}),
		});

		if (!res.ok) {
			const data = await res.json();
			setError(data.error || "Signup failed");
			return;
		}

		router.push(LOGIN);
	};

	if (!inviteToken) {
		return (
			<main className="flex min-h-screen items-center justify-center p-4">
				<div className="w-full max-w-sm space-y-4 text-center">
					<h1 className="text-2xl font-bold">Sign up</h1>
					<p className="text-gray-600">
						Sign up is by invitation only. Open the link from your invitation email to
						continue.
					</p>
					<p className="text-sm">
						Already have an account?{" "}
						<a href={LOGIN} className="underline">
							Log in
						</a>
					</p>
				</div>
			</main>
		);
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
				<h1 className="text-2xl font-bold">Sign Up</h1>

				{error && <p className="text-red-500">{error}</p>}

				<input
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="w-full border p-2 rounded"
					required
				/>
				<input
					type="text"
					placeholder="Username"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					className="w-full border p-2 rounded"
					required
				/>
				<input
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					className="w-full border p-2 rounded"
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
		</main>
	);
}

export default function SignupPage() {
	return (
		<Suspense
			fallback={
				<main className="flex min-h-screen items-center justify-center p-4">
					<p className="text-gray-600">Loading…</p>
				</main>
			}
		>
			<SignupForm />
		</Suspense>
	);
}
