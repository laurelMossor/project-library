"use client";

import { useEffect, useState } from "react";
import { ClickableProfilePicture } from "./ClickableProfilePicture";
import { InlineHandleField } from "./InlineHandleField";
import { InlineNameField } from "./InlineNameField";
import { OptionalTitle, handleFromName } from "@/lib/components/inline-editable/OptionalTitle";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import type { IdentityEntity } from "./ActiveIdentityEditor";
import type { CardEntity } from "@/lib/types/card";

/**
 * Photo, display name and handle in one outlined block, laid out like the profile header.
 * The name and handle are session fields; the photo saves on its own when picked.
 */
export function EditableIdentityBlock({
	entity,
	merge,
	followHandle = false,
	draft = false,
}: {
	entity: IdentityEntity;
	merge: (patch: Record<string, unknown>) => void;
	/** Setup: the name starts as the handle. */
	followHandle?: boolean;
	/** The entity doesn't exist yet: the photo joins the draft instead of saving, and the handle opens for typing. */
	draft?: boolean;
}) {
	const session = useInlineEditSession();
	const isPage = entity.type === "page";
	const { value: handle } = useInlineField<string>("handle", entity.data.handle);
	// Each field is filled from the other once, until that field is typed by hand.
	const [nameTouched, setNameTouched] = useState(false);
	const [handleTouched, setHandleTouched] = useState(false);
	const [suggestedHandle, setSuggestedHandle] = useState<string | null>(null);
	const [suggestedName, setSuggestedName] = useState<string | null>(null);
	const cancelRevision = session?.cancelRevision ?? 0;

	useEffect(() => {
		if (cancelRevision === 0) return;
		setNameTouched(false);
		setHandleTouched(false);
		setSuggestedHandle(null);
		setSuggestedName(null);
	}, [cancelRevision]);

	const card: CardEntity = isPage
		? {
			id: entity.data.id,
			name: entity.data.name,
			handle: entity.data.handle,
			avatarImageId: entity.data.avatarImageId,
			avatarImage: entity.data.avatarImage,
		}
		: {
			id: entity.data.id,
			handle: entity.data.handle,
			displayName: entity.data.displayName,
			avatarImageId: entity.data.avatarImageId,
			avatarImage: entity.data.avatarImage,
		};

	return (
		<div className="mb-6 flex items-start gap-4 rounded-lg border-2 border-rich-brown bg-white p-4">
			<ClickableProfilePicture
				entity={card}
				canEdit
				persistAvatar={draft ? async (id) => session?.setDirty("avatarImageId", id, null) : undefined}
				onSaved={(avatar) => merge({
					avatarImageId: avatar?.id ?? null,
					avatarImage: avatar ? { url: avatar.url } : null,
				})}
			/>
			<div className="min-w-0 flex-1 space-y-3">
				{draft && isPage ? (
					<PageDraftName
						suggestedName={nameTouched ? null : suggestedName}
						onNameTyped={(next) => {
							setNameTouched(true);
							if (!handleTouched) setSuggestedHandle(handleFromName(next));
						}}
					/>
				) : (
					<InlineNameField
						name={isPage ? "name" : "displayName"}
						label={isPage ? "Page Name" : "Display Name"}
						stored={isPage ? entity.data.name : entity.data.displayName}
						handle={handle}
						followHandle={followHandle}
						valueClassName="text-2xl font-bold"
					/>
				)}
				<InlineHandleField
					original={entity.data.handle}
					startEditing={draft || followHandle}
					highlight={draft || followHandle}
					suggested={draft && isPage ? suggestedHandle : null}
					handEdited={handleTouched}
					onHandTyped={draft && isPage ? (next) => {
						setHandleTouched(true);
						if (!nameTouched) setSuggestedName(next);
					} : undefined}
				/>
			</div>
		</div>
	);
}

function PageDraftName({
	suggestedName,
	onNameTyped,
}: {
	/** A hand-typed handle, applied only while the name itself hasn't been typed. */
	suggestedName: string | null;
	onNameTyped: (next: string) => void;
}) {
	const session = useInlineEditSession();
	// Ignore the staged "New page" name so the placeholder shows until someone types.
	const { value, setValue } = useInlineField<string>("name", "");
	const [editing, setEditing] = useState(true);

	useEffect(() => {
		if (suggestedName == null) return;
		setValue(suggestedName);
	}, [suggestedName, setValue]);

	return (
		<OptionalTitle
			value={value || ""}
			onChange={(next) => {
				setValue(next);
				onNameTyped(next);
			}}
			canEdit={session?.canEdit ?? false}
			isEditing={editing}
			onEditStart={() => setEditing(true)}
			onCancel={() => setEditing(false)}
			placeholder="Think of a name for your Page"
			sizeClassName="text-2xl"
			showPlaceholder
		/>
	);
}
