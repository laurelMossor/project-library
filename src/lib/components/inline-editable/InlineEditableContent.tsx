"use client";

import { useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";

type InlineEditableContentProps = {
	value: string;
	canEdit: boolean;
	placeholder?: string;
	/**
	 * Called with the trimmed value when the user clicks Save.
	 * Throw to show an inline error; return normally to close the editor.
	 */
	onCommit: (value: string) => Promise<void>;
};

export function InlineEditableContent({
	value,
	canEdit,
	placeholder = "Add a description",
	onCommit,
}: InlineEditableContentProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	return (
		<InlineEditable
			canEdit={canEdit}
			isEditing={isEditing}
			onEditStart={() => {
				setEditValue(value);
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
				<p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap">
					{value || (canEdit ? placeholder : "")}
				</p>
			}
			editContent={
				<textarea
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					placeholder={placeholder}
					rows={6}
					maxLength={5000}
					className="w-full text-base leading-relaxed text-gray-700 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
					autoFocus
				/>
			}
		/>
	);
}
