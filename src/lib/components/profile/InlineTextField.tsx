"use client";

import { useEffect, useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { FieldLabel, type FieldVisibility } from "./FieldLabel";

const inputClasses = "w-full border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent";

/**
 * One single-line profile field. The session owns the dirty value; this only
 * owns whether the input is open. Empty saves as null.
 */
export function InlineTextField({
	name,
	label,
	original,
	placeholder,
	maxLength = 100,
	visibility,
	optional = false,
	valueClassName = "text-base",
	startEditing = false,
}: {
	name: string;
	label: string;
	original: string | null;
	placeholder: string;
	maxLength?: number;
	visibility?: FieldVisibility;
	optional?: boolean;
	/** Text style for the shown value and the input, e.g. a heading size. */
	valueClassName?: string;
	/** Open for typing straight away, for a field the person is expected to fill in. */
	startEditing?: boolean;
}) {
	const session = useInlineEditSession();
	const { value, setValue } = useInlineField<string | null>(name, original);
	const [editing, setEditing] = useState(startEditing);
	const [draft, setDraft] = useState(original ?? "");
	const canEdit = session?.canEdit ?? false;
	const cancelRevision = session?.cancelRevision ?? 0;

	useEffect(() => {
		if (cancelRevision === 0) return;
		setDraft(original ?? "");
		setEditing(false);
	}, [cancelRevision, original]);

	return (
		<div>
			<InlineEditable
				canEdit={canEdit}
				isEditing={editing}
				onEditStart={() => { setDraft(value ?? ""); setEditing(true); }}
				onCancel={() => setEditing(false)}
				displayContent={
					<div>
						<FieldLabel label={label} visibility={visibility} optional={optional} />
						<div className="mt-1">
							<InlinePlaceholder value={value} placeholder={placeholder}>
								<p className={valueClassName}>{value}</p>
							</InlinePlaceholder>
						</div>
					</div>
				}
				editContent={
					<div>
						<FieldLabel label={label} visibility={visibility} optional={optional} />
						<input
							type="text"
							value={draft}
							onChange={(e) => {
								setDraft(e.target.value);
								setValue(e.target.value.trim() || null);
							}}
							placeholder={placeholder}
							maxLength={maxLength}
							className={`${inputClasses} ${valueClassName}`}
							autoFocus
						/>
					</div>
				}
			/>
		</div>
	);
}
