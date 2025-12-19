"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [tags, setTags] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setError("");

		// Basic client-side validation
		if (!title.trim()) {
			setError("Title is required");
			setSubmitting(false);
			return;
		}

		if (!description.trim()) {
			setError("Description is required");
			setSubmitting(false);
			return;
		}

		try {
			const res = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim(),
					tags: tags.trim() ? tags.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				// Handle auth errors - redirect to login if unauthorized
				if (res.status === 401) {
					router.push("/login?callbackUrl=/projects/new");
					return;
				}
				setError(data.error || "Failed to create project");
				setSubmitting(false);
				return;
			}

			const project = await res.json();
			router.push(`/projects/${project.id}`);
		} catch (err) {
			setError("Failed to create project");
			setSubmitting(false);
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-4">
				<h1 className="text-2xl font-bold">Create New Project</h1>

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
						Separate tags with commas. Maximum 10 tags.
					</p>
				</div>

				<div className="flex gap-4">
					<button
						type="submit"
						disabled={submitting}
						className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
					>
						{submitting ? "Creating..." : "Create Project"}
					</button>
					<button
						type="button"
						onClick={() => router.back()}
						className="px-4 py-2 border border-black rounded"
					>
						Cancel
					</button>
				</div>
			</form>
		</main>
	);
}

