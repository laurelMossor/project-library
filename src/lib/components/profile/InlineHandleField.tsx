"use client";

import { useEffect, useState } from "react";
import { HandleInput } from "@/lib/components/forms/HandleInput";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { FieldLabel } from "./FieldLabel";

/**
 * The handle as an ordinary session field. While the draft isn't a free, valid handle the
 * session keeps the original, so an unusable handle is never sent. The session's save
 * routes it to the handle endpoint (see ActiveIdentityEditor).
 */
export function InlineHandleField({
	original,
	startEditing = false,
	highlight = false,
	suggested = null,
	handEdited = false,
	onHandTyped,
}: {
	original: string;
	startEditing?: boolean;
	highlight?: boolean;
	/** While the person hasn't typed a handle, a page name's slug fills this field. */
	suggested?: string | null;
	/** Once true, `suggested` no longer overwrites what they typed. */
	handEdited?: boolean;
	/** Fires only for a keystroke in this field, not when a suggestion fills it. */
	onHandTyped?: (next: string) => void;
}) {
	const session = useInlineEditSession();
	const { value, setValue } = useInlineField<string>("handle", original);
	const [editing, setEditing] = useState(startEditing);
	const [draft, setDraft] = useState(original);
	const cancelRevision = session?.cancelRevision ?? 0;

	useEffect(() => {
		if (cancelRevision === 0) return;
		setDraft(original);
		setEditing(false);
	}, [cancelRevision, original]);

	useEffect(() => {
		if (handEdited || !suggested) return;
		setDraft(suggested);
	}, [handEdited, suggested]);

	return (
		<InlineEditable
			canEdit={session?.canEdit ?? false}
			isEditing={editing}
			onEditStart={() => { setDraft(value); setEditing(true); }}
			onCancel={() => setEditing(false)}
			displayContent={
				<div>
					<FieldLabel label="Handle" visibility="public" />
					<div className="mt-1">
						<InlinePlaceholder value={value} placeholder="Choose a handle">
							<p className="text-base text-dusty-grey">@{value}</p>
						</InlinePlaceholder>
					</div>
				</div>
			}
			editContent={
				<div>
					<HandleInput
						value={draft}
						currentHandle={original}
						highlight={highlight}
						onChange={(next) => { setDraft(next); onHandTyped?.(next); }}
						onAvailable={(ok) => setValue(ok ? draft.trim().toLowerCase() : original)}
						autoFocus
					/>
				</div>
			}
		/>
	);
}
