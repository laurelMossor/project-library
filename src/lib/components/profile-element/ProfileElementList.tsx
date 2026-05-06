"use client";

import { useEffect, useState } from "react";
import type { ProfileElementItem } from "@/lib/types/profile-element";
import type { ElementDraft } from "@/lib/types/inline-edit";
import { ProfileElementCard } from "./ProfileElementCard";
import { AddElementButton } from "./AddElementButton";
import { LinkEditor } from "./editors/LinkEditor";
import { TextEditor } from "./editors/TextEditor";
import { TrashIcon } from "@/lib/components/icons/icons";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";

type ProfileElementListProps = {
	elements: ProfileElementItem[];
};

// ─── Per-kind editor dispatcher ────────────────────────────────────────────

function EditorForKind({
	element,
	onFieldChange,
}: {
	element: ProfileElementItem;
	onFieldChange: (field: string, value: unknown, original?: unknown) => void;
}) {
	if (element.kind === "LINK") {
		return <LinkEditor initial={element} onFieldChange={onFieldChange} />;
	}
	return <TextEditor initial={element} onFieldChange={onFieldChange} />;
}

// ─── Draft editor ─────────────────────────────────────────────────────────

function DraftEditorForKind({
	draft,
	onFieldChange,
}: {
	draft: ElementDraft;
	onFieldChange: (field: string, value: unknown) => void;
}) {
	const initial = { label: draft.label, value: draft.value, caption: draft.caption, url: draft.url };

	if (draft.kind === "LINK") {
		return <LinkEditor initial={initial} onFieldChange={onFieldChange} />;
	}
	return <TextEditor initial={initial} onFieldChange={onFieldChange} />;
}

// ─── List ──────────────────────────────────────────────────────────────────

export function ProfileElementList({ elements }: ProfileElementListProps) {
	const session = useInlineEditSession();
	const canEdit = !!session?.canEdit;
	const [editingId, setEditingId] = useState<string | null>(null);

	// Reset editing state when session is cancelled or canEdit changes (preview mode)
	useEffect(() => {
		setEditingId(null);
	}, [session?.cancelRevision, canEdit]);

	const drafts = session?.pendingCreates ?? [];

	if (elements.length === 0 && drafts.length === 0 && !canEdit) {
		return null;
	}

	return (
		<div className="space-y-2">
			{elements.map((element) => {
				const isPendingDelete = session?.pendingDeletes.includes(element.id) ?? false;
				const isEditing = editingId === element.id && !isPendingDelete;

				const onFieldChange = (field: string, value: unknown, original?: unknown) => {
					session?.setDirty(`element:${element.id}:${field}`, value, original ?? null);
				};

				const trashSlot = canEdit && isEditing ? (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							session?.markDeleted(element.id);
							setEditingId(null);
						}}
						className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
						aria-label="Delete element"
					>
						<TrashIcon className="w-3.5 h-3.5" />
					</button>
				) : undefined;

				return (
					<ProfileElementCard
						key={element.id}
						element={element}
						isPendingDelete={isPendingDelete}
						isEditing={isEditing}
						editContent={
							isEditing ? (
								<EditorForKind element={element} onFieldChange={onFieldChange} />
							) : undefined
						}
						onClick={canEdit && !isPendingDelete && !isEditing ? () => setEditingId(element.id) : undefined}
						actionSlot={trashSlot}
					/>
				);
			})}

			{/* Draft elements */}
			{drafts.map((draft) => (
				<div key={draft.tempId} className="flex items-start gap-2">
					<div className="flex-1 min-w-0">
						<DraftEditorForKind
							draft={draft}
							onFieldChange={(field, value) => session?.updateCreate(draft.tempId, field, value)}
						/>
					</div>
					<button
						type="button"
						onClick={() => session?.removeCreate(draft.tempId)}
						className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded flex-shrink-0 pt-0.5"
						aria-label="Remove draft"
					>
						<TrashIcon className="w-3.5 h-3.5" />
					</button>
				</div>
			))}

			{canEdit && (
				<AddElementButton
					onAdd={(draft) => session?.addCreate(draft)}
					nextSortOrder={elements.length + drafts.length}
				/>
			)}
		</div>
	);
}
