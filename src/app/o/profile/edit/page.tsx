"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { API_ME_ORG, LOGIN_WITH_CALLBACK, ORG_PROFILE_EDIT, PRIVATE_ORG_PAGE } from "@/lib/const/routes";

export default function EditOrgProfilePage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

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
	const [isPublic, setIsPublic] = useState(true);

	// Load current org profile data
	useEffect(() => {
		fetch(API_ME_ORG)
			.then((res) => {
				// Handle auth errors - redirect to login if unauthorized
				if (res.status === 401) {
					router.push(LOGIN_WITH_CALLBACK(PRIVATE_ORG_PAGE));
					return;
				}
				return res.json();
			})
			.then((data) => {
				if (data && data.error) {
					setError(data.error);
				} else if (data) {
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
					setIsPublic(data.isPublic !== undefined ? data.isPublic : true);
				}
				setLoading(false);
			})
			.catch(() => {
				setError("Failed to load org profile");
				setLoading(false);
			});
	}, [router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
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
			// Handle auth errors - redirect to login if unauthorized
			if (res.status === 401) {
				router.push(LOGIN_WITH_CALLBACK(PRIVATE_ORG_PAGE));
				return;
			}
			setError(data.error || "Failed to save");
			setSaving(false);
			return;
		}

		router.push(PRIVATE_ORG_PAGE);
	};

	if (loading) {
		return <FormLayout><div>Loading...</div></FormLayout>;
	}

	return (
		<FormLayout maxWidth="md">
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Edit Org Profile</h1>

				<FormError error={error} />

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

				<FormField label="Parent Topic" htmlFor="parentTopic" helpText="Main topic or category for this organization">
					<FormInput
						id="parentTopic"
						type="text"
						value={parentTopic}
						onChange={(e) => setParentTopic(e.target.value)}
						placeholder="e.g. Arts & Crafts"
					/>
				</FormField>

				<FormField label="Privacy" htmlFor="isPublic">
					<div className="flex items-center gap-2">
						<input
							id="isPublic"
							type="checkbox"
							checked={isPublic}
							onChange={(e) => setIsPublic(e.target.checked)}
							className="w-4 h-4"
						/>
						<label htmlFor="isPublic" className="text-sm">
							Public profile (visible to everyone)
						</label>
					</div>
					<p className="text-xs text-gray-500 mt-1">Uncheck to make this organization private</p>
				</FormField>

				<FormActions
					submitLabel="Save Profile"
					onCancel={() => router.push("/o/profile")}
					loading={saving}
					disabled={saving}
				/>
			</form>
		</FormLayout>
	);
}
