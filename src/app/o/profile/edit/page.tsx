"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { LOGIN_WITH_CALLBACK } from "@/lib/const/routes";

export default function EditOrgProfilePage() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const [headline, setHeadline] = useState("");
	const [bio, setBio] = useState("");
	const [interests, setInterests] = useState("");
	const [location, setLocation] = useState("");

	// Load current org profile data
	useEffect(() => {
		fetch("/api/org/profile")
			.then((res) => {
				// Handle auth errors - redirect to login if unauthorized
				if (res.status === 401) {
					router.push(LOGIN_WITH_CALLBACK("/o/profile/edit"));
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

		const res = await fetch("/api/org/profile", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
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
				router.push(LOGIN_WITH_CALLBACK("/o/profile/edit"));
				return;
			}
			setError(data.error || "Failed to save");
			setSaving(false);
			return;
		}

		router.push("/o/profile");
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
