"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicUser } from "@/lib/types/user";

type EditableProfileProps = {
	user: PublicUser;
};

export function EditableProfile({ user: initialUser }: EditableProfileProps) {
	const router = useRouter();
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [name, setName] = useState(initialUser.name || "");
	const [headline, setHeadline] = useState(initialUser.headline || "");
	const [bio, setBio] = useState(initialUser.bio || "");
	const [interests, setInterests] = useState(initialUser.interests?.join(", ") || "");
	const [location, setLocation] = useState(initialUser.location || "");

	const handleSave = async () => {
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
			if (res.status === 401) {
				router.push("/login?callbackUrl=/profile");
				return;
			}
			setError(data.error || "Failed to save");
			setSaving(false);
			return;
		}

		setSaving(false);
		setIsEditing(false);
		router.refresh();
	};

	const handleCancel = () => {
		setName(initialUser.name || "");
		setHeadline(initialUser.headline || "");
		setBio(initialUser.bio || "");
		setInterests(initialUser.interests?.join(", ") || "");
		setLocation(initialUser.location || "");
		setIsEditing(false);
		setError("");
	};

	if (isEditing) {
		return (
			<div className="space-y-4">
				{error && <p className="text-red-500 text-sm">{error}</p>}

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Name</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Username</label>
					<p className="text-sm">@{initialUser.username}</p>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Headline</label>
					<input
						type="text"
						value={headline}
						onChange={(e) => setHeadline(e.target.value)}
						placeholder="e.g. Full-stack developer"
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Bio</label>
					<textarea
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						rows={4}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Interests (comma-separated)</label>
					<input
						type="text"
						value={interests}
						onChange={(e) => setInterests(e.target.value)}
						placeholder="e.g. React, TypeScript, Design"
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Location</label>
					<input
						type="text"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="e.g. San Francisco, CA"
						className="w-full border p-2 rounded"
					/>
				</div>

				<div className="flex gap-2">
					<button
						onClick={handleSave}
						disabled={saving}
						className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
					>
						{saving ? "Saving..." : "Save"}
					</button>
					<button
						onClick={handleCancel}
						disabled={saving}
						className="px-4 py-2 border rounded disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div>
				<span className="text-sm text-gray-500">Name:</span>
				<p>{initialUser.name || "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Username:</span>
				<p>@{initialUser.username}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Headline:</span>
				<p>{initialUser.headline || "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Bio:</span>
				<p>{initialUser.bio || "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Interests:</span>
				<p>{initialUser.interests?.length ? initialUser.interests.join(", ") : "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Location:</span>
				<p>{initialUser.location || "Not set"}</p>
			</div>
			<button
				onClick={() => setIsEditing(true)}
				className="text-sm underline"
			>
				Edit
			</button>
		</div>
	);
}

