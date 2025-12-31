"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectItem } from "@/lib/types/project";
import { updateProject } from "@/lib/utils/project-client";
import { Button } from "@/lib/components/ui/Button";

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
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [uploadingImage, setUploadingImage] = useState(false);

	// Get existing image URL for edit mode
	const existingImageUrl = project?.images?.[0]?.url || project?.imageUrl;

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			// Validate file type
			const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
			if (!allowedTypes.includes(file.type)) {
				setError("Invalid file type. Only JPEG, PNG, and WebP images are allowed");
				return;
			}

			// Validate file size (5MB max)
			if (file.size > 5 * 1024 * 1024) {
				setError("File size too large. Maximum size is 5MB");
				return;
			}

			setImageFile(file);
			setError("");

			// Create preview
			const reader = new FileReader();
			reader.onloadend = () => {
				setImagePreview(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

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
		<main className="flex min-h-screen items-center justify-center p-4">
			<form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-4">
				<h1 className="text-2xl font-bold">{isEditMode ? "Edit Project" : "Create New Project"}</h1>

				{error && <p className="text-red-500">{error}</p>}

				<div>
					<label htmlFor="title" className="block text-sm font-medium mb-1">
						Title <span className="text-red-500">*</span>
					</label>
					<input
						id="title"
						type="text"
						placeholder="Project title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="w-full border p-2 rounded"
						required
						maxLength={200}
					/>
				</div>

				<div>
					<label htmlFor="description" className="block text-sm font-medium mb-1">
						Description <span className="text-red-500">*</span>
					</label>
					<textarea
						id="description"
						placeholder="Describe your project..."
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="w-full border p-2 rounded"
						rows={8}
						required
						maxLength={5000}
					/>
				</div>

				<div>
					<label htmlFor="tags" className="block text-sm font-medium mb-1">
						Tags (optional)
					</label>
					<input
						id="tags"
						type="text"
						placeholder="tag1, tag2, tag3"
						value={tags}
						onChange={(e) => setTags(e.target.value)}
						className="w-full border p-2 rounded"
					/>
					<p className="text-xs text-gray-500 mt-1">
						Separate tags with commas. Maximum {MAX_TAGS} tags.
					</p>
				</div>

				<div>
					<label htmlFor="image" className="block text-sm font-medium mb-1">
						Project Image (optional)
					</label>
					<input
						id="image"
						type="file"
						accept="image/jpeg,image/jpg,image/png,image/webp"
						onChange={handleImageChange}
						className="w-full border p-2 rounded"
					/>
					<p className="text-xs text-gray-500 mt-1">
						JPEG, PNG, or WebP. Maximum 5MB.
					</p>
					{(imagePreview || existingImageUrl) && (
						<div className="mt-2">
							<img
								src={imagePreview || existingImageUrl || undefined}
								alt="Preview"
								className="max-w-full h-auto max-h-64 rounded border"
							/>
						</div>
					)}
				</div>

				<div className="flex gap-4">
					<Button
						type="submit"
						disabled={submitting || uploadingImage}
						loading={submitting || uploadingImage}
					>
						{isEditMode ? "Update Project" : "Create Project"}
					</Button>
					<Button
						type="button"
						onClick={() => {
							if (isEditMode && project) {
								router.push(`/projects/${project.id}`);
							} else {
								router.back();
							}
						}}
						variant="secondary"
					>
						Cancel
					</Button>
				</div>
			</form>
		</main>
	);
}

