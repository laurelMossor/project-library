"use client";

import { useEffect, useState } from "react";
import type { ProfileElementItem } from "@/lib/types/profile-element";
import type { ElementDraft } from "@/lib/types/inline-edit";
import { ProfileElementCard } from "./ProfileElementCard";
import { AddElementButton } from "./AddElementButton";
import { SocialLinkEditor } from "./editors/SocialLinkEditor";
import { CtaEditor } from "./editors/CtaEditor";
import { TextEditor } from "./editors/TextEditor";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";

type ProfileElementListProps = {
	elements: ProfileElementItem[];
};

// ─── Trash icon ────────────────────────────────────────────────────────────

function TrashIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6l-1 14H6L5 6" />
			<path d="M10 11v6M14 11v6" />
			<path d="M9 6V4h6v2" />
		</svg>
	);
}

// ─── Per-kind editor dispatcher ────────────────────────────────────────────

function EditorForKind({
	element,
	onFieldChange,
	onCancel,
}: {
	element: ProfileElementItem;
	onFieldChange: (field: string, value: unknown, original?: unknown) => void;
	onCancel?: () => void;
}) {
	if (element.kind === "SOCIAL_LINK") {
		return <SocialLinkEditor initial={element} onFieldChange={onFieldChange} onCancel={onCancel} />;
	}
	if (element.kind === "CTA") {
		return <CtaEditor initial={element} onFieldChange={onFieldChange} onCancel={onCancel} />;
	}
	return <TextEditor initial={element} onFieldChange={onFieldChange} onCancel={onCancel} />;
}

// ─── Draft card (always in edit mode) ─────────────────────────────────────

function DraftEditorForKind({
	draft,
	onFieldChange,
	onCancel,
}: {
	draft: ElementDraft;
	onFieldChange: (field: string, value: unknown) => void;
	onCancel: () => void;
}) {
	const initial = { label: draft.label, value: draft.value, caption: draft.caption, url: draft.url };
	const wrap = (field: string, value: unknown) => onFieldChange(field, value);

	if (draft.kind === "SOCIAL_LINK") {
		return <SocialLinkEditor initial={initial} onFieldChange={wrap} onCancel={onCancel} />;
	}
	if (draft.kind === "CTA") {
		return <CtaEditor initial={initial} onFieldChange={wrap} onCancel={onCancel} />;
	}
	return <TextEditor initial={initial} onFieldChange={wrap} onCancel={onCancel} />;
}

// ─── List ──────────────────────────────────────────────────────────────────

export function ProfileElementList({ elements }: ProfileElementListProps) {
	const session = useInlineEditSession();
	const canEdit = !!session?.canEdit;
	const [editingId, setEditingId] = useState<string | null>(null);

	// Reset editing state when the session is cancelled
	useEffect(() => {
		setEditingId(null);
	}, [session?.cancelRevision]);

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

				const trashSlot = canEdit && !isPendingDelete ? (
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
						<TrashIcon />
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
								<EditorForKind
									element={element}
									onFieldChange={onFieldChange}
									onCancel={() => setEditingId(null)}
								/>
							) : undefined
						}
						onClick={canEdit && !isPendingDelete && !isEditing ? () => setEditingId(element.id) : undefined}
						actionSlot={trashSlot}
					/>
				);
			})}

			{/* Draft elements — always in edit mode */}
			{drafts.map((draft) => (
				<div
					key={draft.tempId}
					className="border border-moss-green/40 rounded-lg p-3 ring-1 ring-moss-green/30"
				>
					<DraftEditorForKind
						draft={draft}
						onFieldChange={(field, value) => session?.updateCreate(draft.tempId, field, value)}
						onCancel={() => session?.removeCreate(draft.tempId)}
					/>
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
