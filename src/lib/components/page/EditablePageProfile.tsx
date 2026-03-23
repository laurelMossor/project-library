"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PublicPage } from "@/lib/types/page";
import { Button } from "@/lib/components/ui/Button";
import { API_ME_PAGE, LOGIN_WITH_CALLBACK, PRIVATE_PAGE } from "@/lib/const/routes";

type EditablePageProfileProps = {
	page: PublicPage;
	isEditing?: boolean;
	onEditingChange?: (isEditing: boolean) => void;
};

export function EditablePageProfile({ page: initialPage, isEditing: controlledIsEditing, onEditingChange }: EditablePageProfileProps) {
	const router = useRouter();
	const [internalIsEditing, setInternalIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	// Use controlled state if provided, otherwise use internal state
	const isEditing = controlledIsEditing !== undefined ? controlledIsEditing : internalIsEditing;
	const setIsEditing = (value: boolean) => {
		if (onEditingChange) {
			onEditingChange(value);
		} else {
			setInternalIsEditing(value);
		}
	};

	const [name, setName] = useState(initialPage.name || "");
	const [headline, setHeadline] = useState(initialPage.headline || "");
	const [bio, setBio] = useState(initialPage.bio || "");
	const [interests, setInterests] = useState(initialPage.interests?.join(", ") || "");
	const [location, setLocation] = useState(initialPage.location || "");

	// Reset form when editing starts
	useEffect(() => {
		if (isEditing) {
			setName(initialPage.name || "");
			setHeadline(initialPage.headline || "");
			setBio(initialPage.bio || "");
			setInterests(initialPage.interests?.join(", ") || "");
			setLocation(initialPage.location || "");
			setError("");
		}
	}, [isEditing, initialPage]);

	const handleSave = async () => {
		setSaving(true);
		setError("");

		const res = await fetch(API_ME_PAGE, {
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
				router.push(LOGIN_WITH_CALLBACK(PRIVATE_PAGE));
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
		setIsEditing(false);
		setError("");
	};

	if (isEditing) {
		return (
			<div className="space-y-4">
				{error && <p className="text-red-500 text-sm">{error}</p>}

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Page Name</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Slug</label>
					<p className="text-sm">/{initialPage.slug}</p>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Headline</label>
					<input
						type="text"
						value={headline}
						onChange={(e) => setHeadline(e.target.value)}
						placeholder="e.g. Community Art Collective"
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
						placeholder="e.g. Art, Design, Community"
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

	return (
		<div className="space-y-4">
			<div>
				<span className="text-sm text-gray-500">Name:</span>
				<p>{initialPage.name}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Slug:</span>
				<p>/{initialPage.slug}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Headline:</span>
				<p>{initialPage.headline || "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Bio:</span>
				<p>{initialPage.bio || "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Interests:</span>
				<p>{initialPage.interests?.length ? initialPage.interests.join(", ") : "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Location:</span>
				<p>{initialPage.location || "Not set"}</p>
			</div>
		</div>
	);
}
