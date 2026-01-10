"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicUser } from "@/lib/types/user";
import { Button } from "@/lib/components/ui/Button";
import { API_PROFILE, LOGIN_WITH_CALLBACK, PRIVATE_USER_PAGE } from "@/lib/const/routes";

type EditableProfileProps = {
	user: PublicUser;
};

export function EditableProfile({ user: initialUser }: EditableProfileProps) {
	const router = useRouter();
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [firstName, setFirstName] = useState(initialUser.firstName || "");
	const [middleName, setMiddleName] = useState(initialUser.middleName || "");
	const [lastName, setLastName] = useState(initialUser.lastName || "");
	const [headline, setHeadline] = useState(initialUser.headline || "");
	const [bio, setBio] = useState(initialUser.bio || "");
	const [interests, setInterests] = useState(initialUser.interests?.join(", ") || "");
	const [location, setLocation] = useState(initialUser.location || "");

	const handleSave = async () => {
		setSaving(true);
		setError("");

		const res = await fetch(API_PROFILE, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				firstName,
				middleName,
				lastName,
				headline,
				bio,
				interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
				location,
			}),
		});

		if (!res.ok) {
			const data = await res.json();
			if (res.status === 401) {
				router.push(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
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
		setFirstName(initialUser.firstName || "");
		setMiddleName(initialUser.middleName || "");
		setLastName(initialUser.lastName || "");
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
					<label className="block text-sm font-medium mb-1 text-gray-500">First Name</label>
					<input
						type="text"
						value={firstName}
						onChange={(e) => setFirstName(e.target.value)}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Middle Name (optional)</label>
					<input
						type="text"
						value={middleName}
						onChange={(e) => setMiddleName(e.target.value)}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Last Name</label>
					<input
						type="text"
						value={lastName}
						onChange={(e) => setLastName(e.target.value)}
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
					<Button
						onClick={handleSave}
						disabled={saving}
						loading={saving}
					>
						Save
					</Button>
					<Button
						onClick={handleCancel}
						disabled={saving}
						variant="secondary"
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	const displayName = [initialUser.firstName, initialUser.middleName, initialUser.lastName]
		.filter(Boolean)
		.join(' ') || initialUser.username;

	return (
		<div className="space-y-4">
			<div>
				<span className="text-sm text-gray-500">Name:</span>
				<p>{displayName}</p>
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

