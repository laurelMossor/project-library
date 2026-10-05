"use client";

import { ClickableProfilePicture } from "./ClickableProfilePicture";
import { InlineHandleField } from "./InlineHandleField";
import { InlineNameField } from "./InlineNameField";
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
				<InlineNameField
					name={isPage ? "name" : "displayName"}
					label={isPage ? "Page Name" : "Display Name"}
					stored={isPage ? entity.data.name : entity.data.displayName}
					handle={handle}
					// A page being created has no handle-derived name; it opens ready for one.
					followHandle={followHandle && !(draft && isPage)}
					placeholder={draft && isPage ? "Think of a name for your page" : undefined}
					startEditing={draft && isPage}
					valueClassName="text-2xl font-bold"
				/>
				<InlineHandleField original={entity.data.handle} startEditing={draft} />
			</div>
		</div>
	);
}
