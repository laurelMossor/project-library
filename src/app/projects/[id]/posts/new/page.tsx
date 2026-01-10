"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { PROJECT_DETAIL } from "@/lib/const/routes";

export default function NewProjectPostPage() {
	const params = useParams();
	const projectId = params.id as string;
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSubmitting(true);

		try {
			const res = await fetch(`/api/projects/${projectId}/posts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: title.trim() || null,
					content: content.trim(),
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to create post");
				setSubmitting(false);
				return;
			}

			// Redirect back to project page
			router.push(PROJECT_DETAIL(projectId));
			router.refresh();
		} catch (err) {
			setError("Failed to create post. Please try again.");
			setSubmitting(false);
		}
	};

	return (
		<FormLayout>
			<h1 className="text-2xl font-bold mb-6">New Project Post</h1>

			<form onSubmit={handleSubmit} className="space-y-4">
				<FormError error={error} />

				<FormField label="Title (optional)" htmlFor="title">
					<FormInput
						id="title"
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="e.g., Update #1, Progress Update"
					/>
				</FormField>

				<FormField label="Content" htmlFor="content" required>
					<FormTextarea
						id="content"
						value={content}
						onChange={(e) => setContent(e.target.value)}
						className="min-h-[200px]"
						placeholder="Write your project update..."
						required
					/>
				</FormField>

				<FormActions
					submitLabel="Create Post"
					onCancel={() => router.back()}
					loading={submitting}
					disabled={submitting}
				/>
			</form>
		</FormLayout>
	);
}

