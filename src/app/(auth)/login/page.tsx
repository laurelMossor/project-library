"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const router = useRouter();

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
			router.push("/");
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
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
				<button
					type="submit"
					className="w-full bg-black text-white p-2 rounded"
				>
					Log In
				</button>

				<p className="text-sm text-center">
					Don't have an account?{" "}
					<a href="/signup" className="underline">Sign up</a>
				</p>
			</form>
		</main>
	);
}

