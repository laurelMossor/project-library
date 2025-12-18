"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditProfilePage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [name, setName] = useState("");
	const [headline, setHeadline] = useState("");
	const [bio, setBio] = useState("");
	const [interests, setInterests] = useState("");
	const [location, setLocation] = useState("");

	// Load current profile data
	useEffect(() => {
		fetch("/api/profile")
			.then((res) => res.json())
			.then((data) => {
				if (data.error) {
					setError(data.error);
				} else {
					setName(data.name || "");
					setHeadline(data.headline || "");
					setBio(data.bio || "");
					setInterests(data.interests?.join(", ") || "");
					setLocation(data.location || "");
				}
				setLoading(false);
			});
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError("");

		const res = await fetch("/api/profile", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name,
				headline,
				bio,
				interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
				location,
			}),
		});

		if (!res.ok) {
			const data = await res.json();
			setError(data.error || "Failed to save");
			setSaving(false);
			return;
		}

		router.push("/profile");
	};

	if (loading) {
		return <main className="flex min-h-screen items-center justify-center">Loading...</main>;
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
				<h1 className="text-2xl font-bold">Edit Profile</h1>

				{error && <p className="text-red-500">{error}</p>}

				<div>
					<label className="block text-sm font-medium mb-1">Name</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1">Headline</label>
					<input
						type="text"
						value={headline}
						onChange={(e) => setHeadline(e.target.value)}
						placeholder="e.g. Full-stack developer"
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1">Bio</label>
					<textarea
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						rows={4}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1">Interests (comma-separated)</label>
					<input
						type="text"
						value={interests}
						onChange={(e) => setInterests(e.target.value)}
						placeholder="e.g. React, TypeScript, Design"
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1">Location</label>
					<input
						type="text"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="e.g. San Francisco, CA"
						className="w-full border p-2 rounded"
					/>
				</div>

				<button
					type="submit"
					disabled={saving}
					className="w-full bg-black text-white p-2 rounded disabled:opacity-50"
				>
					{saving ? "Saving..." : "Save Profile"}
				</button>

				<a href="/profile" className="block text-center underline">Cancel</a>
			</form>
		</main>
	);
}

