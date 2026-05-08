"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { API_ME_USER, SETTINGS } from "@/lib/const/routes";

type UserData = {
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
};

export function PersonalInfoForm() {
	const router = useRouter();
	const { activeEntity } = useActiveProfile();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const [firstName, setFirstName] = useState("");
	const [middleName, setMiddleName] = useState("");
	const [lastName, setLastName] = useState("");

	const isPage = activeEntity ? "name" in activeEntity : false;

	useEffect(() => {
		fetch(API_ME_USER)
			.then((r) => (r.ok ? r.json() : null))
			.then((data: UserData | null) => {
				if (data) {
					setFirstName(data.firstName ?? "");
					setMiddleName(data.middleName ?? "");
					setLastName(data.lastName ?? "");
				}
			})
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

	if (isPage) {
		return (
			<div className="text-center py-12">
				<h1 className="text-2xl font-bold mb-4">Personal Info</h1>
				<p className="text-gray-500 mb-6">
					Personal info editing is only available for personal accounts.
				</p>
				<Link href={SETTINGS} className="text-sm underline text-gray-600">
					Back to Settings
				</Link>
			</div>
		);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError("");
		setSuccess(false);

		try {
			const res = await fetch(API_ME_USER, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fields: {
						firstName: firstName.trim() || null,
						middleName: middleName.trim() || null,
						lastName: lastName.trim() || null,
					},
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Failed to save");
			}

			setSuccess(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Personal Info</h1>
				<p className="text-sm text-gray-500 mt-1">
					This information is private and not shown on your public profile.
				</p>
			</div>

			<FormError error={error} />

			{success && (
				<p className="text-sm text-moss-green">Saved successfully.</p>
			)}

			<FormField label="First Name" htmlFor="firstName">
				<FormInput
					id="firstName"
					type="text"
					value={firstName}
					onChange={(e) => setFirstName(e.target.value)}
					maxLength={100}
				/>
			</FormField>

			<FormField label="Middle Name" htmlFor="middleName">
				<FormInput
					id="middleName"
					type="text"
					value={middleName}
					onChange={(e) => setMiddleName(e.target.value)}
					maxLength={100}
				/>
			</FormField>

			<FormField label="Last Name" htmlFor="lastName">
				<FormInput
					id="lastName"
					type="text"
					value={lastName}
					onChange={(e) => setLastName(e.target.value)}
					maxLength={100}
				/>
			</FormField>

			<FormActions
				submitLabel="Save"
				onCancel={() => router.push(SETTINGS)}
				loading={saving}
			/>
		</form>
	);
}
