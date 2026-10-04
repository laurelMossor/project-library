"use client";

import { useEffect, useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { FieldLabel } from "./FieldLabel";

const inputClasses = "w-full text-base border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent";

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
	isPublic = false,
	highlight = false,
}: {
	name: string;
	label: string;
	original: string | null;
	placeholder: string;
	maxLength?: number;
	isPublic?: boolean;
	/** Accent outline, used on setup for a field the person can change or leave. */
	highlight?: boolean;
}) {
	const session = useInlineEditSession();
	const { value, setValue } = useInlineField<string | null>(name, original);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(original ?? "");
	const canEdit = session?.canEdit ?? false;
	const cancelRevision = session?.cancelRevision ?? 0;

	useEffect(() => {
		if (cancelRevision === 0) return;
		setDraft(original ?? "");
		setEditing(false);
	}, [cancelRevision, original]);

	return (
		<div className={highlight ? "rounded-md ring-2 ring-rich-brown p-3" : undefined}>
			<InlineEditable
				canEdit={canEdit}
				isEditing={editing}
				onEditStart={() => { setDraft(value ?? ""); setEditing(true); }}
				onCancel={() => setEditing(false)}
				displayContent={
					<div>
						<FieldLabel label={label} isPublic={isPublic} />
						<InlinePlaceholder value={value} placeholder={placeholder}>
							<p className="text-base mt-1">{value}</p>
						</InlinePlaceholder>
					</div>
				}
				editContent={
					<div>
						<FieldLabel label={label} isPublic={isPublic} />
						<input
							type="text"
							value={draft}
							onChange={(e) => {
								setDraft(e.target.value);
								setValue(e.target.value.trim() || null);
							}}
							placeholder={placeholder}
							maxLength={maxLength}
							className={inputClasses}
							autoFocus
						/>
					</div>
				}
			/>
		</div>
	);
}
