"use client";

import { useState } from "react";

type DeleteConfirmButtonProps = {
	label: string;
	itemTitle?: string;
	onDelete: () => Promise<void>;
	confirmLabel?: string;
	variant?: "destructive" | "subtle";
};

export function DeleteConfirmButton({
	label,
	itemTitle,
	onDelete,
	confirmLabel = "Delete",
	variant = "destructive",
}: DeleteConfirmButtonProps) {
	const [showConfirm, setShowConfirm] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState("");

	const handleDelete = async () => {
		setIsDeleting(true);
		setError("");
		try {
			await onDelete();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setIsDeleting(false);
		}
	};

	if (showConfirm) {
		return (
			<div className="flex flex-col gap-2">
				{itemTitle && (
					<p className="text-sm text-gray-700">
						Are you sure you want to delete &apos;{itemTitle}&apos;?
					</p>
				)}
				{error && <p className="text-sm text-red-600">{error}</p>}
				<div className="flex gap-2">
					<button
						onClick={handleDelete}
						disabled={isDeleting}
						className="rounded border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
					>
						{isDeleting ? "Deleting..." : confirmLabel}
					</button>
					<button
						onClick={() => {
							setShowConfirm(false);
							setError("");
						}}
						disabled={isDeleting}
						className="rounded border border-gray-400 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-black hover:text-black disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	const triggerClass =
		variant === "destructive"
			? "rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
			: "rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:border-red-400 hover:text-red-600";

	return (
		<button onClick={() => setShowConfirm(true)} className={triggerClass}>
			{label}
		</button>
	);
}
