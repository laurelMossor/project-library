"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { API_PAGES, LOGIN_WITH_CALLBACK, EXPLORE_PAGE, PUBLIC_PROFILE } from "@/lib/const/routes";
import { generateHandle } from "@/lib/utils/handle";

/**
 * PAGES NEW
 *
 * Minimal create form: only name + slug (the two required, unique identifiers).
 * On submit: POST /api/pages to create the page, then redirect to the public
 * profile (/p/[slug]) where the owner can inline-edit all fields.
 */
export default function NewPagePage() {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [name, setName] = useState("");
	const [handle, setHandle] = useState("");
	const [autoGenerateHandle, setAutoGenerateHandle] = useState(true);

	const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newName = e.target.value;
		setName(newName);
		if (autoGenerateHandle) setHandle(generateHandle(newName));
	};

	const handleHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setHandle(e.target.value);
		setAutoGenerateHandle(false);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError("");

		const finalHandle = handle.trim() || generateHandle(name.trim());

		const res = await fetch(API_PAGES, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: name.trim(), handle: finalHandle }),
		});

		if (!res.ok) {
			const data = await res.json();
			if (res.status === 401) {
				router.push(LOGIN_WITH_CALLBACK(EXPLORE_PAGE));
				return;
			}
			setError(data.error || "Failed to create page");
			setSaving(false);
			return;
		}

		const page = await res.json();
		router.push(PUBLIC_PROFILE(page.handle));
	};

	return (
		<FormLayout maxWidth="sm">
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Create Page</h1>
				<p className="text-sm text-gray-500">You can fill in headline, bio, and other details after creating the page.</p>

				<FormError error={error} />

				<FormField label="Page Name" htmlFor="name" required>
					<FormInput
						id="name"
						type="text"
						value={name}
						onChange={handleNameChange}
						placeholder="e.g. Portland Makers Guild"
						required
					/>
				</FormField>

				<FormField
					label="URL Handle"
					htmlFor="handle"
					helpText="Used in your page's URL. Only lowercase letters, numbers, and hyphens."
					required
				>
					<FormInput
						id="handle"
						type="text"
						value={handle}
						onChange={handleHandleChange}
						placeholder="e.g. portland-makers-guild"
						pattern="[a-z0-9-]+"
						required
					/>
				</FormField>

				<FormActions
					submitLabel="Create Page"
					onCancel={() => router.push(EXPLORE_PAGE)}
					loading={saving}
					disabled={saving || !name.trim() || !handle.trim()}
				/>
			</form>
		</FormLayout>
	);
}
