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
	/** Scale only. Posts use text-4xl; a page name uses text-2xl. Color and weight live here. */
	sizeClassName?: string;
	maxLength?: number;
	/** Empty drafts show the placeholder. Published empty titles stay blank. */
	showPlaceholder?: boolean;
};

/** Typed title. Kept apart from the placeholder so the two never share a class and fight. */
const TITLE_CLASS = "leading-tight font-bold text-rich-brown";
/** Empty-state hint. Faded, so it cannot be read as the title. */
const PLACEHOLDER_CLASS = "leading-tight font-normal italic text-misty-forest/50";

/**
 * The optional title editor used on posts and on a page draft's name.
 * Callers own the value and the size; this owns the two looks.
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
	sizeClassName = "text-4xl",
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
					<h1 className={`${sizeClassName} ${TITLE_CLASS}`}>{value}</h1>
				) : showPlaceholder ? (
					<h1 className={`${sizeClassName} ${PLACEHOLDER_CLASS}`}>{placeholder}</h1>
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
					className={`w-full border-none outline-none bg-transparent placeholder:font-normal placeholder:italic placeholder:text-misty-forest/50 ${sizeClassName} ${TITLE_CLASS}`}
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
