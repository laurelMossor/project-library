"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { useInlineEditSessionContext } from "./InlineEditSession";

/**
 * InlineEditable — Generic base component for inline editing.
 *
 * Two modes:
 *   1. **Session mode** (when wrapped in <InlineEditSession>): no per-field
 *      Save/Cancel buttons. The session bar handles save/cancel for the whole
 *      resource. The parent is responsible for calling session.setDirty() when
 *      the field value changes.
 *   2. **Standalone mode** (no parent session): renders its own Save/Cancel
 *      buttons using the `onSave` prop. Backward-compatible with existing use.
 *
 * Usage (session mode):
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
	/** Only used in standalone mode (no parent InlineEditSession). */
	onSave?: () => Promise<void>;
	/** Only used in standalone mode. */
	saving?: boolean;
	/** Only used in standalone mode. */
	error?: string;
	/**
	 * Force standalone mode even inside an InlineEditSession.
	 * Use for fields that save immediately and don't participate in batched save
	 * (e.g. date/time picker, avatar upload).
	 */
	isolate?: boolean;
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
	onSave,
	saving = false,
	error,
	isolate = false,
	className = "",
}: InlineEditableProps) {
	const session = useInlineEditSessionContext();
	const standaloneMode = session === null || isolate;
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
				{standaloneMode && onSave && (
					<div className="flex items-center gap-2 mt-2">
						<button
							type="button"
							onClick={onSave}
							disabled={saving}
							className="px-3 py-1 text-sm font-medium text-white bg-moss-green rounded hover:bg-rich-brown transition-colors disabled:opacity-50"
						>
							{saving ? "Saving..." : "Save"}
						</button>
						<button
							type="button"
							onClick={onCancel}
							disabled={saving}
							className="px-3 py-1 text-sm font-medium text-warm-grey border border-soft-grey rounded hover:bg-soft-grey/20 transition-colors disabled:opacity-50"
						>
							Cancel
						</button>
					</div>
				)}
				{standaloneMode && error && (
					<p className="text-sm text-alert-red mt-1">{error}</p>
				)}
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
