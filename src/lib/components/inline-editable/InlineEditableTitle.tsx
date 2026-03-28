"use client";

import { useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";

type InlineEditableTitleProps = {
	value: string | null;
	canEdit: boolean;
	placeholder?: string;
	emptyLabel?: string;
	/**
	 * Called with the trimmed value when the user clicks Save.
	 * Throw to show an inline error; return normally to close the editor.
	 */
	onCommit: (value: string) => Promise<void>;
};

export function InlineEditableTitle({
	value,
	canEdit,
	placeholder = "Title",
	emptyLabel = "Untitled",
	onCommit,
}: InlineEditableTitleProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	return (
		<InlineEditable
			canEdit={canEdit}
			isEditing={isEditing}
			onEditStart={() => {
				setEditValue(value || "");
				setError("");
				setIsEditing(true);
			}}
			onSave={async () => {
				setSaving(true);
				setError("");
				try {
					await onCommit(editValue.trim());
					setIsEditing(false);
				} catch (err) {
					setError(err instanceof Error ? err.message : "Failed to save");
				} finally {
					setSaving(false);
				}
			}}
			onCancel={() => { setIsEditing(false); setError(""); }}
			saving={saving}
			error={error}
			displayContent={
				<h1 className="text-4xl font-bold text-rich-brown leading-tight">
					{value || (canEdit ? placeholder : emptyLabel)}
				</h1>
			}
			editContent={
				<input
					type="text"
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					placeholder={placeholder}
					className="w-full text-4xl font-bold text-rich-brown border-b-2 border-rich-brown/20 pb-1 focus:outline-none focus:border-rich-brown bg-transparent"
					maxLength={150}
					autoFocus
				/>
			}
		/>
	);
}
