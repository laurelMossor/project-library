"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";

/**
 * InlineEditable — Generic base component for inline editing.
 *
 * Resource-agnostic: works for Events, User Profiles, Page Profiles, Posts.
 * The caller provides the save handler wired to the correct API endpoint.
 *
 * Usage:
 *   <InlineEditable
 *     canEdit={isOwner}
 *     isEditing={editingField === "title"}
 *     onEditStart={() => setEditingField("title")}
 *     onSave={async () => { await patchEvent(id, { title }); }}
 *     onCancel={() => setEditingField(null)}
 *     saving={saving}
 *     error={error}
 *     displayContent={<h1>{title}</h1>}
 *     editContent={<input value={title} onChange={...} />}
 *   />
 */

type InlineEditableProps = {
	canEdit: boolean;
	isEditing: boolean;
	onEditStart: () => void;
	onSave: () => Promise<void>;
	onCancel: () => void;
	displayContent: ReactNode;
	editContent: ReactNode;
	saving?: boolean;
	error?: string;
	/** Additional class for the wrapper */
	className?: string;
};

export function InlineEditable({
	canEdit,
	isEditing,
	onEditStart,
	onSave,
	onCancel,
	displayContent,
	editContent,
	saving = false,
	error,
	className = "",
}: InlineEditableProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!isEditing) return;
			if (e.key === "Escape") {
				e.preventDefault();
				onCancel();
			}
		},
		[isEditing, onCancel]
	);

	useEffect(() => {
		if (isEditing) {
			document.addEventListener("keydown", handleKeyDown);
			return () => document.removeEventListener("keydown", handleKeyDown);
		}
	}, [isEditing, handleKeyDown]);

	if (isEditing) {
		return (
			<div ref={wrapperRef} className={`relative ${className}`}>
				{editContent}
				<div className="flex items-center gap-2 mt-2">
					<button
						type="button"
						onClick={onSave}
						disabled={saving}
						className="px-3 py-1 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 disabled:opacity-50"
					>
						{saving ? "Saving..." : "Save"}
					</button>
					<button
						type="button"
						onClick={onCancel}
						disabled={saving}
						className="px-3 py-1 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
				{error && <p className="text-sm text-alert-red mt-1">{error}</p>}
			</div>
		);
	}

	if (!canEdit) {
		return <div className={className}>{displayContent}</div>;
	}

	// Editable display mode: subtle edit affordance on hover
	return (
		<div
			className={`group relative cursor-pointer rounded-md transition-colors hover:bg-gray-50 ${className}`}
			onClick={onEditStart}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onEditStart();
				}
			}}
		>
			{displayContent}
			<span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 text-xs pointer-events-none">
				Edit
			</span>
		</div>
	);
}
