"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { API_ME_USER, LOGIN_WITH_CALLBACK, PRIVATE_USER_PAGE } from "@/lib/const/routes";

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

	// Load current profile data
	useEffect(() => {
		fetch(API_ME_USER)
			.then((res) => {
				// Handle auth errors - redirect to login if unauthorized
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
			}),
		});

		if (!res.ok) {
			const data = await res.json();
			// Handle auth errors - redirect to login if unauthorized
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

	if (loading) {
		return <FormLayout><div>Loading...</div></FormLayout>;
	}

	return (
		<FormLayout maxWidth="md">
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Edit Profile</h1>

				<FormError error={error} />

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
