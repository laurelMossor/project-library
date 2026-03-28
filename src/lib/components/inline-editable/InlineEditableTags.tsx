"use client";

import { useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { Tag } from "@/lib/components/tag/Tag";

type InlineEditableTagsProps = {
	value: string[];
	canEdit: boolean;
	/**
	 * Called with the parsed tag array when the user clicks Save.
	 * Throw to show an inline error; return normally to close the editor.
	 */
	onCommit: (tags: string[]) => Promise<void>;
};

function parseTags(raw: string): string[] {
	return raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean)
		.slice(0, 10);
}

export function InlineEditableTags({ value, canEdit, onCommit }: InlineEditableTagsProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	return (
		<InlineEditable
			canEdit={canEdit}
			isEditing={isEditing}
			onEditStart={() => {
				setEditValue(value.join(", "));
				setError("");
				setIsEditing(true);
			}}
			onSave={async () => {
				setSaving(true);
				setError("");
				try {
					await onCommit(parseTags(editValue));
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
				value.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{value.map((tag) => <Tag key={tag} tag={tag} />)}
					</div>
				) : (
					<p className="text-sm text-gray-400">Add tags</p>
				)
			}
			editContent={
				<input
					type="text"
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					placeholder="Tag1, Tag2, Tag3"
					className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
					autoFocus
				/>
			}
		/>
	);
}
