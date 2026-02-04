"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { API_ME_ORG, LOGIN_WITH_CALLBACK, PRIVATE_ORG_PAGE } from "@/lib/const/routes";
import { Tag } from "../tag/Tag";
import { PublicOrg } from "@/lib/types/org";

type EditableOrgProfileProps = {
	org: PublicOrg;
	isEditing?: boolean;
	onEditingChange?: (isEditing: boolean) => void;
};

export function EditableOrgProfile({ org, isEditing: controlledIsEditing, onEditingChange }: EditableOrgProfileProps) {
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

	const [headline, setHeadline] = useState(org.headline || "");
	const [bio, setBio] = useState(org.bio || "");
	const [interests, setInterests] = useState(org.interests?.join(", ") || "");
	const [location, setLocation] = useState(org.location || "");
	const [addressLine1, setAddressLine1] = useState(org.addressLine1 || "");
	const [addressLine2, setAddressLine2] = useState(org.addressLine2 || "");
	const [city, setCity] = useState(org.city || "");
	const [state, setState] = useState(org.state || "");
	const [zip, setZip] = useState(org.zip || "");
	const [parentTopic, setParentTopic] = useState(org.parentTopic || "");
	const [isPublic, setIsPublic] = useState(org.isPublic !== undefined ? org.isPublic : true);

	// Reset form when editing starts
	useEffect(() => {
		if (isEditing) {
			setHeadline(org.headline || "");
			setBio(org.bio || "");
			setInterests(org.interests?.join(", ") || "");
			setLocation(org.location || "");
			setAddressLine1(org.addressLine1 || "");
			setAddressLine2(org.addressLine2 || "");
			setCity(org.city || "");
			setState(org.state || "");
			setZip(org.zip || "");
			setParentTopic(org.parentTopic || "");
			setIsPublic(org.isPublic !== undefined ? org.isPublic : true);
			setError("");
		}
	}, [isEditing, org]);

	const handleSave = async () => {
		setSaving(true);
		setError("");

		const res = await fetch(API_ME_ORG, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				headline,
				bio,
				interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
				location,
				addressLine1: addressLine1 || null,
				addressLine2: addressLine2 || null,
				city: city || null,
				state: state || null,
				zip: zip || null,
				parentTopic: parentTopic || null,
				isPublic,
			}),
		});

		if (!res.ok) {
			const data = await res.json();
			if (res.status === 401) {
				router.push(LOGIN_WITH_CALLBACK(PRIVATE_ORG_PAGE));
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
					<label className="block text-sm font-medium mb-1 text-gray-500">Name</label>
					<p className="text-sm">{org.name}</p>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Slug</label>
					<p className="text-sm">@{org.slug}</p>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Headline</label>
					<input
						type="text"
						value={headline}
						onChange={(e) => setHeadline(e.target.value)}
						placeholder="e.g. Community makerspace"
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
						placeholder="e.g. Woodworking, Electronics, 3D Printing"
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

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Address Line 1</label>
					<input
						type="text"
						value={addressLine1}
						onChange={(e) => setAddressLine1(e.target.value)}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Address Line 2 (optional)</label>
					<input
						type="text"
						value={addressLine2}
						onChange={(e) => setAddressLine2(e.target.value)}
						className="w-full border p-2 rounded"
					/>
				</div>

				<div className="grid grid-cols-3 gap-4">
					<div>
						<label className="block text-sm font-medium mb-1 text-gray-500">City</label>
						<input
							type="text"
							value={city}
							onChange={(e) => setCity(e.target.value)}
							className="w-full border p-2 rounded"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-1 text-gray-500">State</label>
						<input
							type="text"
							value={state}
							onChange={(e) => setState(e.target.value)}
							className="w-full border p-2 rounded"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-1 text-gray-500">ZIP</label>
						<input
							type="text"
							value={zip}
							onChange={(e) => setZip(e.target.value)}
							className="w-full border p-2 rounded"
						/>
					</div>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1 text-gray-500">Parent Topic</label>
					<input
						type="text"
						value={parentTopic}
						onChange={(e) => setParentTopic(e.target.value)}
						placeholder="e.g. Arts & Crafts"
						className="w-full border p-2 rounded"
					/>
				</div>

				<div>
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={isPublic}
							onChange={(e) => setIsPublic(e.target.checked)}
							className="w-4 h-4"
						/>
						<span className="text-sm font-medium text-gray-500">Public Organization</span>
					</label>
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

	const displayName = org.name;
	const headlineDisplay = org.headline;
	const locationDisplay = org.location;
	const bioDisplay = org.bio;
	const interestsDisplay = org.interests || [];

	return (
		<div className="space-y-4">
			<div>
				<span className="text-sm text-gray-500">Name:</span>
				<p>{displayName}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Slug:</span>
				<p>@{org.slug}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Headline:</span>
				<p>{headlineDisplay || "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Bio:</span>
				<p>{bioDisplay || "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Interests:</span>
				<p>{interestsDisplay.length ? interestsDisplay.join(", ") : "Not set"}</p>
			</div>
			<div>
				<span className="text-sm text-gray-500">Location:</span>
				<p>{locationDisplay || "Not set"}</p>
			</div>
			{(org.addressLine1 || org.city || org.state || org.zip) && (
				<div>
					<span className="text-sm text-gray-500">Address:</span>
					<p>
						{[
							org.addressLine1,
							org.addressLine2,
							[org.city, org.state, org.zip].filter(Boolean).join(", "),
						]
							.filter(Boolean)
							.join("\n")}
					</p>
				</div>
			)}
			{org.parentTopic && (
				<div>
					<span className="text-sm text-gray-500">Parent Topic:</span>
					<p>{org.parentTopic}</p>
				</div>
			)}
			<div>
				<span className="text-sm text-gray-500">Visibility:</span>
				<p>{org.isPublic ? "Public" : "Private"}</p>
			</div>
		</div>
	);
}
