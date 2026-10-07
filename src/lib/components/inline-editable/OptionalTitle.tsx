"use client";

import { InlineEditable } from "./InlineEditable";

type Props = {
	value: string;
	onChange: (next: string) => void;
	canEdit: boolean;
	isEditing: boolean;
	onEditStart: () => void;
	onCancel: () => void;
	onCommit?: () => void;
	placeholder?: string;
	/** Heading and input share this scale. Posts use text-4xl; a page name uses text-2xl. */
	textClassName?: string;
	maxLength?: number;
	/** Empty drafts show the placeholder. Published empty titles stay blank. */
	showPlaceholder?: boolean;
};

/**
 * The optional title editor used on posts and on a page draft's name.
 * Callers own the value; this only draws the same click-to-edit field.
 */
export function OptionalTitle({
	value,
	onChange,
	canEdit,
	isEditing,
	onEditStart,
	onCancel,
	onCommit,
	placeholder = "Title (optional)",
	textClassName = "text-4xl leading-tight font-bold text-rich-brown",
	maxLength = 150,
	showPlaceholder = false,
}: Props) {
	return (
		<InlineEditable
			canEdit={canEdit}
			isEditing={isEditing}
			onEditStart={onEditStart}
			onCancel={onCancel}
			displayContent={
				value ? (
					<h1 className={textClassName}>{value}</h1>
				) : showPlaceholder ? (
					<h1 className={`${textClassName} font-normal italic text-misty-forest/50`}>
						{placeholder}
					</h1>
				) : null
			}
			editContent={
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onBlur={onCancel}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							onCommit?.();
							onCancel();
						}
					}}
					placeholder={placeholder}
					maxLength={maxLength}
					className={`w-full border-none outline-none bg-transparent ${textClassName}`}
					autoFocus
				/>
			}
		/>
	);
}

/** A page name becomes a handle: lowercase, and anything outside the handle alphabet becomes a hyphen. */
export function handleFromName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 30);
}
