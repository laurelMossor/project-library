"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";

export default function NewProjectEntryPage() {
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
			const res = await fetch(`/api/projects/${projectId}/entries`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: title.trim() || undefined,
					content: content.trim(),
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to create entry");
				setSubmitting(false);
				return;
			}

			// Redirect back to project page
			router.push(`/projects/${projectId}`);
			router.refresh();
		} catch (err) {
			setError("Failed to create entry. Please try again.");
			setSubmitting(false);
		}
	};

	return (
		<main className="flex min-h-screen items-center justify-center p-8">
			<div className="w-full max-w-2xl">
				<h1 className="text-2xl font-bold mb-6">New Project Entry</h1>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && <p className="text-red-500">{error}</p>}

					<div>
						<label htmlFor="title" className="block text-sm font-medium mb-1">
							Title (optional)
						</label>
						<input
							id="title"
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="w-full border p-2 rounded"
							placeholder="e.g., Update #1, Progress Update"
						/>
					</div>

					<div>
						<label htmlFor="content" className="block text-sm font-medium mb-1">
							Content <span className="text-red-500">*</span>
						</label>
						<textarea
							id="content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							className="w-full border p-2 rounded min-h-[200px]"
							placeholder="Write your project update..."
							required
						/>
					</div>

					<div className="flex gap-4">
						<Button
							type="submit"
							disabled={submitting}
							loading={submitting}
						>
							Create Entry
						</Button>
						<Button
							type="button"
							onClick={() => router.back()}
							variant="secondary"
						>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		</main>
	);
}

