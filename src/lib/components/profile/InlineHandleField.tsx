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
 * routes it to the handle action (see ActiveIdentityEditor).
 */
export function InlineHandleField({
	original,
	startEditing = false,
	highlight = false,
	blankUntilChosen = false,
	suggested = null,
	onHandTyped,
}: {
	original: string;
	startEditing?: boolean;
	highlight?: boolean;
	/** The stored handle is only there so the row can exist. The field stays empty until one is chosen. */
	blankUntilChosen?: boolean;
	/** A page name's slug. The caller clears it once the handle is typed by hand. */
	suggested?: string | null;
	/** Fires only for a keystroke in this field, not when a suggestion fills it. */
	onHandTyped?: (next: string) => void;
}) {
	const session = useInlineEditSession();
	// A staged page already has a handle. Treat that as unset so it doesn't look chosen.
	const shown = blankUntilChosen ? "" : original;
	const { value, setValue } = useInlineField<string>("handle", shown);
	const [editing, setEditing] = useState(startEditing);
	const [draft, setDraft] = useState(shown);
	const cancelRevision = session?.cancelRevision ?? 0;

	useEffect(() => {
		if (cancelRevision === 0) return;
		setDraft(shown);
		setEditing(false);
	}, [cancelRevision, shown]);

	useEffect(() => {
		if (!suggested) return;
		setDraft(suggested);
	}, [suggested]);

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
						onAvailable={(ok) => setValue(ok ? draft.trim().toLowerCase() : shown)}
						autoFocus
					/>
				</div>
			}
		/>
	);
}
