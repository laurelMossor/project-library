"use client";

import { useEffect, useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { FieldLabel } from "./FieldLabel";
import { InlineTextField } from "./InlineTextField";
import { followedName } from "@/lib/utils/identity-name";

type Props = {
	name: "name" | "displayName";
	label: string;
	stored: string | null;
	/** The handle as it currently reads, including an unsaved edit. */
	handle: string;
	/** Setup and create: the name starts as the handle and follows it until it is changed. */
	followHandle?: boolean;
	valueClassName?: string;
	/** Non-following only: the hint inside the input, and whether it opens ready to type. */
	placeholder?: string;
	startEditing?: boolean;
};

/**
 * The display name of a user or page. On setup the name defaults to the handle; everywhere
 * else it is a plain inline text field.
 */
export function InlineNameField({ followHandle = false, ...props }: Props) {
	if (!followHandle) {
		return (
			<InlineTextField
				name={props.name}
				label={props.label}
				original={props.stored}
				placeholder={props.placeholder ?? `Add ${props.label.toLowerCase()}`}
				startEditing={props.startEditing}
				visibility="public"
				valueClassName={props.valueClassName}
			/>
		);
	}
	return <FollowingNameField {...props} />;
}

/**
 * Leaving it untouched saves the handle as the name; a name that already differs from the
 * handle is kept.
 */
function FollowingNameField({ name, label, stored, handle, valueClassName = "text-base" }: Props) {
	const session = useInlineEditSession();
	const [custom, setCustom] = useState<string | null>(stored && stored !== handle ? stored : null);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(handle);
	const shown = followedName(custom, handle);
	const setDirty = session?.setDirty;

	useEffect(() => {
		setDirty?.(name, shown, stored);
	}, [setDirty, name, shown, stored]);

	return (
		<InlineEditable
			canEdit={session?.canEdit ?? false}
			isEditing={editing}
			onEditStart={() => { setDraft(shown); setEditing(true); }}
			onCancel={() => setEditing(false)}
			displayContent={
				<div>
					<FieldLabel label={label} visibility="public" />
					<p className={`mt-1 ${valueClassName}`}>{shown}</p>
					{custom === null && (
						<p className="text-xs text-dusty-grey mt-1">Using your handle. Change it, or leave it.</p>
					)}
				</div>
			}
			editContent={
				<div>
					<FieldLabel label={label} visibility="public" />
					<input
						type="text"
						value={draft}
						onChange={(e) => {
							const next = e.target.value;
							setDraft(next);
							const trimmed = next.trim();
							setCustom(trimmed === handle ? null : trimmed);
						}}
						maxLength={100}
						autoFocus
						className={`w-full border-b border-gray-300 py-1 mt-1 focus:outline-none focus:border-rich-brown bg-transparent ${valueClassName}`}
					/>
				</div>
			}
		/>
	);
}
