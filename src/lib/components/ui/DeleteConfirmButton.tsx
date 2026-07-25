"use client";

import { useState } from "react";

type DeleteConfirmButtonProps = {
	label: string;
	itemTitle?: string;
	onDelete: () => Promise<void>;
	confirmLabel?: string;
	variant?: "destructive" | "subtle" | "link";
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
					<p className="text-sm text-warm-grey">
						Are you sure you want to delete &apos;{itemTitle}&apos;?
					</p>
				)}
				{error && <p className="text-sm text-novel-red">{error}</p>}
				<div className="flex gap-2">
					<button
						onClick={handleDelete}
						disabled={isDeleting}
						className="rounded border border-novel-red bg-novel-red px-4 py-2 text-sm font-medium text-grey-white transition hover:bg-smokey-red disabled:opacity-50"
					>
						{isDeleting ? "Deleting..." : confirmLabel}
					</button>
					<button
						onClick={() => {
							setShowConfirm(false);
							setError("");
						}}
						disabled={isDeleting}
						className="rounded border border-soft-grey px-4 py-2 text-sm font-medium text-warm-grey transition hover:border-rich-brown hover:text-rich-brown disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	const triggerClass =
		variant === "destructive"
			? "rounded border border-novel-red px-4 py-2 text-sm font-medium text-novel-red transition hover:bg-novel-red/10"
			: variant === "link"
				? "text-xs font-medium text-dusty-grey transition hover:text-novel-red"
				: "rounded border border-soft-grey px-3 py-1.5 text-xs font-medium text-misty-forest transition hover:border-smokey-red hover:text-novel-red";

	return (
		<button onClick={() => setShowConfirm(true)} className={triggerClass}>
			{label}
		</button>
	);
}
