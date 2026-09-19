"use client";

import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { Tag } from "@/lib/components/tag/Tag";

type TagsFieldProps = {
	value: string[];
	onChange: (tags: string[]) => void;
	isOwner: boolean;
	isEditing: boolean;
	editingField: string | null;
	onEditStart: () => void;
	onCancel: () => void;
};

/**
 * The single "Tags & Topics" editable field, shared by posts and events.
 * Display mode renders blue `Tag` chiclets; edit mode renders the shared
 * `TagInputField`. One place for this field so the two forms never drift apart.
 */
export function TagsField({
	value,
	onChange,
	isOwner,
	isEditing,
	editingField,
	onEditStart,
	onCancel,
}: TagsFieldProps) {
	return (
		<InlineEditable
			canEdit={isOwner && isEditing}
			isEditing={editingField === "tags"}
			onEditStart={onEditStart}
			onCancel={onCancel}
			displayContent={
				value.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{value.map((tag) => (
							<Tag key={tag} tag={tag} />
						))}
					</div>
				) : (
					<InlinePlaceholder value={null} placeholder="Tags & Topics" chip />
				)
			}
			editContent={<TagInputField tags={value} onTagsChange={onChange} />}
		/>
	);
}
