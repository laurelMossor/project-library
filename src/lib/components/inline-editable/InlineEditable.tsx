"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";

/**
 * InlineEditable — Generic shell for inline editing.
 *
 * Always operates in session mode: wraps content in a clickable display area,
 * switches to edit mode on click, and delegates Save/Cancel to the parent
 * <InlineEditSession>. The parent is responsible for calling session.setDirty()
 * when field values change.
 *
 * Usage:
 *   <InlineEditSession resource={event} onSave={...} canEdit={isOwner}>
 *     <InlineEditable
 *       canEdit={isOwner}
 *       isEditing={editingField === "title"}
 *       onEditStart={() => setEditingField("title")}
 *       onCancel={() => setEditingField(null)}
 *       displayContent={<h1>{title}</h1>}
 *       editContent={<input value={editTitle} onChange={...} />}
 *     />
 *   </InlineEditSession>
 */

type InlineEditableProps = {
	canEdit: boolean;
	isEditing: boolean;
	onEditStart: () => void;
	onCancel: () => void;
	displayContent: ReactNode;
	editContent: ReactNode;
	/** Additional class for the wrapper */
	className?: string;
};

export function InlineEditable({
	canEdit,
	isEditing,
	onEditStart,
	onCancel,
	displayContent,
	editContent,
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

	// In session mode, the global Escape handler on the session itself handles
	// cancelAll. Per-field Escape (above) still closes the individual edit UI.

	if (isEditing) {
		return (
			<div ref={wrapperRef} className={`relative ${className}`}>
				{editContent}
			</div>
		);
	}

	if (!canEdit) {
		return <div className={className}>{displayContent}</div>;
	}

	// Editable display mode: subtle edit affordance on hover
	return (
		<div
			className={`group relative cursor-pointer rounded-md transition-colors hover:bg-melon-green/10 ${className}`}
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
			<span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-misty-forest/60 text-xs pointer-events-none">
				Edit
			</span>
		</div>
	);
}
