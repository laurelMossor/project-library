"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { API_PAGES, LOGIN_WITH_CALLBACK, PAGE_NEW, SETUP } from "@/lib/const/routes";

/**
 * Create a page by name only. The handle is generated on the server, and
 * membership, visibility, and the rest are reviewed on /setup.
 */
export default function NewPagePage() {
	const router = useRouter();
	const { switchProfile } = useActiveProfile();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [name, setName] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setError("");

		const res = await fetch(API_PAGES, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: name.trim() }),
		});

		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			if (res.status === 401) {
				router.push(LOGIN_WITH_CALLBACK(PAGE_NEW));
				return;
			}
			setError(data.error || "Failed to create page");
			setSaving(false);
			return;
		}

		const page = await res.json();
		const switched = await switchProfile(page.id);
		if (!switched) {
			setError("The page was created, but switching into it failed. Open it from your pages list.");
			setSaving(false);
			return;
		}
		router.push(SETUP);
	};

	return (
		<FormLayout maxWidth="sm">
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">Create Page</h1>
				<p className="text-sm text-gray-500">You'll review the handle and settings on the next screen.</p>

				<FormError error={error} />

				<FormField label="Page Name" htmlFor="name" required>
					<FormInput
						id="name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Portland Makers Guild"
						required
					/>
				</FormField>

				<FormActions
					submitLabel="Create Page"
					onCancel={() => router.back()}
					loading={saving}
					disabled={saving || !name.trim()}
				/>
			</form>
		</FormLayout>
	);
}
