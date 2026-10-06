"use client";

import { useState } from "react";
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
	const [suggestedHandle, setSuggestedHandle] = useState<string | null>(null);
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
					<PageDraftName stored={entity.data.name} onSlug={setSuggestedHandle} />
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
				/>
			</div>
		</div>
	);
}

function PageDraftName({ stored, onSlug }: { stored: string; onSlug: (slug: string) => void }) {
	const session = useInlineEditSession();
	const { value, setValue } = useInlineField<string>("name", stored);
	const [editing, setEditing] = useState(true);

	return (
		<OptionalTitle
			value={value || ""}
			onChange={(next) => {
				setValue(next);
				onSlug(handleFromName(next));
			}}
			canEdit={session?.canEdit ?? false}
			isEditing={editing}
			onEditStart={() => setEditing(true)}
			onCancel={() => setEditing(false)}
			placeholder="Think of a name for your page"
			textClassName="text-2xl leading-tight font-bold text-rich-brown"
			showPlaceholder
		/>
	);
}
