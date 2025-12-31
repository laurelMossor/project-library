"use client";

import { signIn, useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/lib/components/ui/Button";

export default function LoginPage() {
	const { data: session } = useSession();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") || "/";

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const result = await signIn("credentials", {
			email,
			password,
			redirect: false,
		});

		if (result?.error) {
			setError("Invalid email or password");
		} else {
			// Force a full page reload to refresh all server components (layout, etc.)
			// This ensures the layout updates to show authenticated state
			window.location.href = callbackUrl;
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-4">
				{session && (
					<div className="bg-gray-100 p-3 rounded text-sm text-center">
						Logged in as {session.user?.email}.{" "}
						<a href="/profile" className="underline">Go to profile</a>
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4">
					<h1 className="text-2xl font-bold">Log In</h1>

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
						type="password"
						placeholder="Password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full border p-2 rounded"
						required
					/>
					<Button type="submit" fullWidth>
						Log In
					</Button>

					<p className="text-sm text-center">
						Don't have an account?{" "}
						<a href="/signup" className="underline">Sign up</a>
					</p>
				</form>
			</div>
		</main>
	);
}
