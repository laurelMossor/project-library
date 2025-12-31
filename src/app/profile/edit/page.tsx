"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";

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
			.then((res) => {
				// Handle auth errors - redirect to login if unauthorized
				if (res.status === 401) {
					router.push("/login?callbackUrl=/profile/edit");
					return;
				}
				return res.json();
			})
			.then((data) => {
				if (data && data.error) {
					setError(data.error);
				} else if (data) {
					setName(data.name || "");
					setHeadline(data.headline || "");
					setBio(data.bio || "");
					setInterests(data.interests?.join(", ") || "");
					setLocation(data.location || "");
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
			// Handle auth errors - redirect to login if unauthorized
			if (res.status === 401) {
				router.push("/login?callbackUrl=/profile/edit");
				return;
			}
			setError(data.error || "Failed to save");
			setSaving(false);
			return;
		}

		router.push("/profile");
	};

	if (loading) {
		return <FormLayout><div>Loading...</div></FormLayout>;
	}

	return (
		<FormLayout maxWidth="md">
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Edit Profile</h1>

				<FormError error={error} />

				<FormField label="Name" htmlFor="name">
					<FormInput
						id="name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
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
					onCancel={() => router.push("/profile")}
					loading={saving}
					disabled={saving}
				/>
			</form>
		</FormLayout>
	);
}

