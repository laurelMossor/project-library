"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPost } from "@/lib/utils/post-client";
import { AuthError } from "@/lib/utils/auth-client";
import { POST_DETAIL, POST_NEW, LOGIN_WITH_CALLBACK } from "@/lib/const/routes";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";

export default function NewPostPage() {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim()) return;

		setSubmitting(true);
		setError("");

		try {
			const post = await createPost({
				title: title.trim() || undefined,
				content: content.trim(),
			});
			router.replace(POST_DETAIL(post.id));
		} catch (err) {
			if (err instanceof AuthError) {
				router.push(LOGIN_WITH_CALLBACK(POST_NEW));
				return;
			}
			setError(err instanceof Error ? err.message : "Failed to create post");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormLayout>
			<h1 className="text-2xl font-bold mb-6">New Post</h1>
			<form onSubmit={handleSubmit}>
				<FormField label="Title (optional)">
					<FormInput
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Give your post a title"
						maxLength={150}
					/>
				</FormField>

				<FormField label="Content" required>
					<FormTextarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="What are you working on or thinking about?"
						rows={6}
						maxLength={5000}
						required
					/>
				</FormField>

				<FormError error={error} />

				<FormActions
					submitLabel={submitting ? "Posting..." : "Post"}
					onCancel={() => router.back()}
					disabled={submitting || !content.trim()}
					loading={submitting}
				/>
			</form>
		</FormLayout>
	);
}
