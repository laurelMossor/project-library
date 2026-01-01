"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { API_AUTH_SIGNUP, LOGIN } from "@/lib/const/routes";

export default function SignupPage() {
	const [email, setEmail] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const res = await fetch(API_AUTH_SIGNUP, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, username, password }),
		});

		if (!res.ok) {
			const data = await res.json();
			setError(data.error || "Signup failed");
			return;
		}

		// Redirect to login after successful signup
		router.push(LOGIN);
	};

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
					<a href={LOGIN} className="underline">Log in</a>
				</p>
			</form>
		</main>
	);
}

