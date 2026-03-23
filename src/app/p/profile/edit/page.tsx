"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { API_ME_PAGE, LOGIN_WITH_CALLBACK, PRIVATE_PAGE } from "@/lib/const/routes";
import { useImageUpload } from "@/lib/hooks/useImageUpload";
import { getPageInitials } from "@/lib/utils/text";

export default function EditPageProfilePage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [pageName, setPageName] = useState("");
	const [headline, setHeadline] = useState("");
	const [bio, setBio] = useState("");
	const [interests, setInterests] = useState("");
	const [location, setLocation] = useState("");
	const [addressLine1, setAddressLine1] = useState("");
	const [addressLine2, setAddressLine2] = useState("");
	const [city, setCity] = useState("");
	const [state, setState] = useState("");
	const [zip, setZip] = useState("");
	const [parentTopic, setParentTopic] = useState("");
	const [avatarImageId, setAvatarImageId] = useState<string | null>(null);
	const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const { imageFile, imagePreview, error: imageError, handleImageChange, clearImage } = useImageUpload();

	// Load current page profile data
	useEffect(() => {
		fetch(API_ME_PAGE)
			.then((res) => {
				if (res.status === 401) {
					router.push(LOGIN_WITH_CALLBACK(PRIVATE_PAGE));
					return;
				}
				return res.json();
			})
			.then((data) => {
				if (data && data.error) {
					setError(data.error);
				} else if (data) {
					setPageName(data.name || "");
					setHeadline(data.headline || "");
					setBio(data.bio || "");
					setInterests(data.interests?.join(", ") || "");
					setLocation(data.location || "");
					setAddressLine1(data.addressLine1 || "");
					setAddressLine2(data.addressLine2 || "");
					setCity(data.city || "");
					setState(data.state || "");
					setZip(data.zip || "");
					setParentTopic(data.parentTopic || "");
					setAvatarImageId(data.avatarImageId || null);
					setExistingAvatarUrl(data.avatarImage?.url || null);
				}
				setLoading(false);
			})
			.catch(() => {
				setError("Failed to load page profile");
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

		const res = await fetch(API_ME_PAGE, {
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
				avatarImageId: newAvatarImageId,
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

		router.push(PRIVATE_PAGE);
	};

	const initials = pageName ? getPageInitials(pageName) : "?";

	if (loading) {
		return <FormLayout><div>Loading...</div></FormLayout>;
	}

	return (
		<FormLayout maxWidth="md">
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Edit Page Profile</h1>

				<FormError error={error} />
				{imageError && <FormError error={imageError} />}

				{/* Avatar Upload */}
				<FormField label="Page Photo" htmlFor="avatar">
					<div className="flex items-center gap-4">
						<div className="w-20 h-20 rounded-full bg-soft-grey flex items-center justify-center overflow-hidden flex-shrink-0">
							{imagePreview || existingAvatarUrl ? (
								<img src={imagePreview || existingAvatarUrl!} alt="Avatar preview" className="w-full h-full object-cover" />
							) : (
								<span className="text-gray-600 font-medium text-lg">{initials}</span>
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

				<FormField label="Headline" htmlFor="headline">
					<FormInput
						id="headline"
						type="text"
						value={headline}
						onChange={(e) => setHeadline(e.target.value)}
						placeholder="e.g. Creative community space"
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
						placeholder="e.g. Art, Community, Workshops"
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

				<div className="border-t pt-4">
					<h2 className="text-lg font-semibold mb-4">Address</h2>

					<FormField label="Address Line 1" htmlFor="addressLine1">
						<FormInput
							id="addressLine1"
							type="text"
							value={addressLine1}
							onChange={(e) => setAddressLine1(e.target.value)}
							placeholder="Street address"
						/>
					</FormField>

					<FormField label="Address Line 2" htmlFor="addressLine2">
						<FormInput
							id="addressLine2"
							type="text"
							value={addressLine2}
							onChange={(e) => setAddressLine2(e.target.value)}
							placeholder="Apartment, suite, etc. (optional)"
						/>
					</FormField>

					<div className="grid grid-cols-2 gap-4">
						<FormField label="City" htmlFor="city">
							<FormInput
								id="city"
								type="text"
								value={city}
								onChange={(e) => setCity(e.target.value)}
								placeholder="City"
							/>
						</FormField>

						<FormField label="State" htmlFor="state">
							<FormInput
								id="state"
								type="text"
								value={state}
								onChange={(e) => setState(e.target.value)}
								placeholder="State"
							/>
						</FormField>
					</div>

					<FormField label="ZIP Code" htmlFor="zip">
						<FormInput
							id="zip"
							type="text"
							value={zip}
							onChange={(e) => setZip(e.target.value)}
							placeholder="ZIP code"
						/>
					</FormField>
				</div>

				<FormField label="Parent Topic" htmlFor="parentTopic" helpText="Main topic or category for this page">
					<FormInput
						id="parentTopic"
						type="text"
						value={parentTopic}
						onChange={(e) => setParentTopic(e.target.value)}
						placeholder="e.g. Arts & Crafts"
					/>
				</FormField>

				<FormActions
					submitLabel="Save Profile"
					onCancel={() => router.push(PRIVATE_PAGE)}
					loading={saving}
					disabled={saving}
				/>
			</form>
		</FormLayout>
	);
}
