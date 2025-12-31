"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectItem } from "@/lib/types/project";
import { updateProject } from "@/lib/utils/project-client";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { useImageUpload } from "@/lib/hooks/useImageUpload";

const MAX_TAGS = 10;

function normalizeTags(tagInput: string): string[] {
	return tagInput
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0)
		.slice(0, MAX_TAGS);
}

type Props = {
	project?: ProjectItem;
};

export function EditProjectForm({ project }: Props) {
	const isEditMode = !!project;
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const [title, setTitle] = useState(project?.title || "");
	const [description, setDescription] = useState(project?.description || "");
	const [tags, setTags] = useState(project?.tags.join(", ") || "");
	const [uploadingImage, setUploadingImage] = useState(false);

	// Get existing image URL for edit mode
	const existingImageUrl = project?.images?.[0]?.url || project?.imageUrl;

	// Use image upload hook
	const {
		imageFile,
		imagePreview,
		error: imageError,
		handleImageChange,
	} = useImageUpload(existingImageUrl);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setSubmitting(true);
		setError("");

		const trimmedTitle = title.trim();
		const trimmedDescription = description.trim();

		if (!trimmedTitle) {
			setError("Title is required");
			setSubmitting(false);
			return;
		}

		if (!trimmedDescription) {
			setError("Description is required");
			setSubmitting(false);
			return;
		}

		// Check for image validation errors
		if (imageError) {
			setError(imageError);
			setSubmitting(false);
			return;
		}

		try {
			if (isEditMode && project) {
				// Update existing project
				await updateProject(project.id, {
					title: trimmedTitle,
					description: trimmedDescription,
					tags: normalizeTags(tags),
				});

				// Upload new image if provided
				if (imageFile && project.id) {
					setUploadingImage(true);
					const formData = new FormData();
					formData.append("image", imageFile);
					formData.append("projectId", project.id);

					try {
						const uploadRes = await fetch("/api/projects/upload", {
							method: "POST",
							body: formData,
						});

						if (!uploadRes.ok) {
							console.warn("Failed to upload image, but project was updated");
						}
					} catch (uploadError) {
						console.warn("Error uploading image:", uploadError);
					} finally {
						setUploadingImage(false);
					}
				}

				router.push(`/projects/${project.id}`);
			} else {
				// Create new project
				const res = await fetch("/api/projects", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title: trimmedTitle,
						description: trimmedDescription,
						tags: normalizeTags(tags),
					}),
				});

				if (!res.ok) {
					const data = await res.json();
					if (res.status === 401) {
						router.push("/login?callbackUrl=/projects/new");
						return;
					}
					setError(data.error || "Failed to create project");
					setSubmitting(false);
					return;
				}

				const projectData = await res.json();

				// Upload and link image if provided (after project creation)
				if (imageFile && projectData.id) {
					setUploadingImage(true);
					const formData = new FormData();
					formData.append("image", imageFile);
					formData.append("projectId", projectData.id);

					try {
						const uploadRes = await fetch("/api/projects/upload", {
							method: "POST",
							body: formData,
						});

						if (!uploadRes.ok) {
							console.warn("Failed to upload image, but project was created");
						}
					} catch (uploadError) {
						console.warn("Error uploading image:", uploadError);
					} finally {
						setUploadingImage(false);
					}
				}

				router.push(`/projects/${projectData.id}`);
			}
		} catch (err) {
			console.error(`Failed to ${isEditMode ? "update" : "create"} project`, err);
			setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? "update" : "create"} project`);
			setSubmitting(false);
		}
	};

	return (
		<FormLayout>
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">{isEditMode ? "Edit Project" : "Create New Project"}</h1>

				<FormError error={error || imageError} />

				<FormField label="Title" htmlFor="title" required>
					<FormInput
						id="title"
						type="text"
						placeholder="Project title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						required
						maxLength={200}
					/>
				</FormField>

				<FormField label="Description" htmlFor="description" required>
					<FormTextarea
						id="description"
						placeholder="Describe your project..."
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={8}
						required
						maxLength={5000}
					/>
				</FormField>

				<FormField label="Tags" htmlFor="tags" helpText={`Separate tags with commas. Maximum ${MAX_TAGS} tags.`}>
					<FormInput
						id="tags"
						type="text"
						placeholder="tag1, tag2, tag3"
						value={tags}
						onChange={(e) => setTags(e.target.value)}
					/>
				</FormField>

				<FormField label="Project Image" htmlFor="image" helpText="JPEG, PNG, or WebP. Maximum 5MB.">
					<input
						id="image"
						type="file"
						accept="image/jpeg,image/jpg,image/png,image/webp"
						onChange={handleImageChange}
						className="w-full border p-2 rounded"
					/>
					{(imagePreview || existingImageUrl) && (
						<div className="mt-2">
							<img
								src={imagePreview || existingImageUrl || undefined}
								alt="Preview"
								className="max-w-full h-auto max-h-64 rounded border"
							/>
						</div>
					)}
				</FormField>

				<FormActions
					submitLabel={isEditMode ? "Update Project" : "Create Project"}
					onCancel={() => {
						if (isEditMode && project) {
							router.push(`/projects/${project.id}`);
						} else {
							router.back();
						}
					}}
					loading={submitting || uploadingImage}
					disabled={submitting || uploadingImage}
				/>
			</form>
		</FormLayout>
	);
}

