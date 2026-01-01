"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/lib/utils/project-client";
import { COLLECTIONS } from "@/lib/const/routes";

type Props = {
	projectId: string;
	projectTitle: string;
};

export function DeleteProjectButton({ projectId, projectTitle }: Props) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [error, setError] = useState("");

	const handleDelete = async () => {
		setIsDeleting(true);
		setError("");

		try {
			await deleteProject(projectId);
			router.push(COLLECTIONS);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete project");
			setIsDeleting(false);
			setShowConfirm(false);
		}
	};

	if (showConfirm) {
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-gray-700">Are you sure you want to delete '{projectTitle}'?</p>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<div className="flex gap-2">
					<button
						onClick={handleDelete}
						disabled={isDeleting}
						className="px-4 py-2 bg-red-600 text-white rounded border border-red-600 hover:bg-red-700 disabled:opacity-50"
					>
						{isDeleting ? "Deleting..." : "Delete"}
					</button>
					<button
						onClick={() => {
							setShowConfirm(false);
							setError("");
						}}
						disabled={isDeleting}
						className="px-4 py-2 border border-black rounded disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	return (
		<button
			onClick={() => setShowConfirm(true)}
			className="px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50 transition-colors"
		>
			Delete Project
		</button>
	);
}

