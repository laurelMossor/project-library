"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { API_ME_USER, LOGIN_WITH_CALLBACK, PRIVATE_USER_PAGE } from "@/lib/const/routes";
import { useImageUpload } from "@/lib/hooks/useImageUpload";

export default function EditProfilePage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [firstName, setFirstName] = useState("");
	const [middleName, setMiddleName] = useState("");
	const [lastName, setLastName] = useState("");
	const [headline, setHeadline] = useState("");
	const [bio, setBio] = useState("");
	const [interests, setInterests] = useState("");
	const [location, setLocation] = useState("");
	const [avatarImageId, setAvatarImageId] = useState<string | null>(null);
	const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const { imageFile, imagePreview, error: imageError, handleImageChange, clearImage } = useImageUpload();

	// Load current profile data
	useEffect(() => {
		fetch(API_ME_USER)
			.then((res) => {
				if (res.status === 401) {
					router.push(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
					return;
				}
				return res.json();
			})
			.then((data) => {
				if (data && data.error) {
					setError(data.error);
				} else if (data) {
					setFirstName(data.firstName || "");
					setMiddleName(data.middleName || "");
					setLastName(data.lastName || "");
					setHeadline(data.headline || "");
					setBio(data.bio || "");
					setInterests(data.interests?.join(", ") || "");
					setLocation(data.location || "");
					setAvatarImageId(data.avatarImageId || null);
					setExistingAvatarUrl(data.avatarImage?.url || null);
				}
				setLoading(false);
			})
			.catch(() => {
				setError("Failed to load profile");
				setLoading(false);
			});
	}, [router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError("");

		let newAvatarImageId = avatarImageId;

		// Upload new avatar if selected
		if (imageFile) {
			const formData = new FormData();
			formData.append("file", imageFile);

			const uploadRes = await fetch("/api/upload?folder=avatars", {
				method: "POST",
				body: formData,
			});

			if (!uploadRes.ok) {
				const data = await uploadRes.json().catch(() => ({}));
				setError(data.error || "Failed to upload avatar");
				setSaving(false);
				return;
			}

			const uploadData = await uploadRes.json();
			newAvatarImageId = uploadData.id;
		}

		const res = await fetch(API_ME_USER, {
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
				avatarImageId: newAvatarImageId,
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

		router.push(PRIVATE_USER_PAGE);
	};

	// Get initials for placeholder
	const getInitials = () => {
		if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
		if (firstName) return firstName[0].toUpperCase();
		return "?";
	};

	if (loading) {
		return <FormLayout><div>Loading...</div></FormLayout>;
	}

	return (
		<FormLayout maxWidth="md">
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Edit Profile</h1>

				<FormError error={error} />
				{imageError && <FormError error={imageError} />}

				{/* Avatar Upload */}
				<FormField label="Profile Photo" htmlFor="avatar">
					<div className="flex items-center gap-4">
						<div className="w-20 h-20 rounded-full bg-soft-grey flex items-center justify-center overflow-hidden flex-shrink-0">
							{imagePreview || existingAvatarUrl ? (
								<img src={imagePreview || existingAvatarUrl!} alt="Avatar preview" className="w-full h-full object-cover" />
							) : (
								<span className="text-gray-600 font-medium text-lg">{getInitials()}</span>
							)}
						</div>
						<div className="flex flex-col gap-2">
							<input
								ref={fileInputRef}
								id="avatar"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onChange={handleImageChange}
								className="hidden"
							/>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 transition-colors"
							>
								{imagePreview ? "Change Photo" : "Upload Photo"}
							</button>
							{imageFile && (
								<button
									type="button"
									onClick={clearImage}
									className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 transition-colors"
								>
									Remove
								</button>
							)}
							<p className="text-xs text-gray-500">JPEG, PNG, or WebP. Max 5MB.</p>
						</div>
					</div>
				</FormField>

				<FormField label="First Name" htmlFor="firstName">
					<FormInput
						id="firstName"
						type="text"
						value={firstName}
						onChange={(e) => setFirstName(e.target.value)}
					/>
				</FormField>

				<FormField label="Middle Name (optional)" htmlFor="middleName">
					<FormInput
						id="middleName"
						type="text"
						value={middleName}
						onChange={(e) => setMiddleName(e.target.value)}
					/>
				</FormField>

				<FormField label="Last Name" htmlFor="lastName">
					<FormInput
						id="lastName"
						type="text"
						value={lastName}
						onChange={(e) => setLastName(e.target.value)}
					/>
				</FormField>

				<FormField label="Headline" htmlFor="headline">
					<FormInput
						id="headline"
						type="text"
						value={headline}
						onChange={(e) => setHeadline(e.target.value)}
						placeholder="e.g. Full-stack developer"
					/>
				</FormField>

				<FormField label="Bio" htmlFor="bio">
					<FormTextarea
						id="bio"
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						rows={4}
					/>
				</FormField>

				<FormField label="Interests (comma-separated)" htmlFor="interests" helpText="Separate interests with commas">
					<FormInput
						id="interests"
						type="text"
						value={interests}
						onChange={(e) => setInterests(e.target.value)}
						placeholder="e.g. React, TypeScript, Design"
					/>
				</FormField>

				<FormField label="Location" htmlFor="location">
					<FormInput
						id="location"
						type="text"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="e.g. San Francisco, CA"
					/>
				</FormField>

				<FormActions
					submitLabel="Save Profile"
					onCancel={() => router.push(PRIVATE_USER_PAGE)}
					loading={saving}
					disabled={saving}
				/>
			</form>
		</FormLayout>
	);
}
