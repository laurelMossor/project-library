"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { API_ORGS, LOGIN_WITH_CALLBACK, PRIVATE_USER_PAGE } from "@/lib/const/routes";
import { generateSlug } from "@/lib/utils/slug";

export default function NewOrgPage() {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [headline, setHeadline] = useState("");
	const [bio, setBio] = useState("");
	const [interests, setInterests] = useState("");
	const [location, setLocation] = useState("");
	const [autoGenerateSlug, setAutoGenerateSlug] = useState(true);

	// Auto-generate slug from name
	const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newName = e.target.value;
		setName(newName);
		if (autoGenerateSlug) {
			setSlug(generateSlug(newName));
		}
	};

	const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSlug(e.target.value);
		setAutoGenerateSlug(false);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError("");

		const res = await fetch(API_ORGS, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: name.trim(),
				slug: slug.trim() || generateSlug(name.trim()),
				headline: headline.trim() || undefined,
				bio: bio.trim() || undefined,
				interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
				location: location.trim() || undefined,
			}),
		});

		if (!res.ok) {
			const data = await res.json();
			// Handle auth errors - redirect to login if unauthorized
			if (res.status === 401) {
				router.push(LOGIN_WITH_CALLBACK(PRIVATE_USER_PAGE));
				return;
			}
			setError(data.error || "Failed to create organization");
			setSaving(false);
			return;
		}

		const org = await res.json();
		// Redirect back to user profile where they can see their new org
		router.push(PRIVATE_USER_PAGE);
	};

	return (
		<FormLayout maxWidth="md">
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Create Organization</h1>

				<FormError error={error} />

				<FormField label="Organization Name" htmlFor="name" required>
					<FormInput
						id="name"
						type="text"
						value={name}
						onChange={handleNameChange}
						placeholder="e.g. Portland Makers Guild"
						required
					/>
				</FormField>

				<FormField label="URL Slug" htmlFor="slug" helpText="Used in your organization's URL. Only lowercase letters, numbers, and hyphens." required>
					<FormInput
						id="slug"
						type="text"
						value={slug}
						onChange={handleSlugChange}
						placeholder="e.g. portland-makers-guild"
						pattern="[a-z0-9-]+"
						required
					/>
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
						placeholder="Tell us about your organization..."
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

				<FormField label="Location" htmlFor="location" helpText="City, State or full address">
					<FormInput
						id="location"
						type="text"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="e.g. Portland, OR"
					/>
				</FormField>

				<FormActions
					submitLabel="Create Organization"
					onCancel={() => router.push(PRIVATE_USER_PAGE)}
					loading={saving}
					disabled={saving}
				/>
			</form>
		</FormLayout>
	);
}
