"use client";

import { useState } from "react";
import { CardEntity, isCardPage } from "@/lib/types/card";
import { ProfilePicture } from "./ProfilePicture";
import { ImageEditModal } from "@/lib/components/images/ImageEditModal";
import { ImageLightbox } from "@/lib/components/images/ImageLightbox";
import { uploadImageOnly } from "@/lib/utils/image-client";
import { saveProfileAction } from "@/lib/actions/profile";
import { useAction } from "@/lib/hooks/useAction";
import type { ProfileTarget } from "@/lib/types/profile";
import { GeneratedAvatar } from "./GeneratedAvatar";

type ClickableProfilePictureProps = {
	entity: CardEntity;
	/** Owner can open the photo editor. Defaults false (public profiles). */
	canEdit?: boolean;
	/** Called after the avatar FK is saved, so a client-loaded profile can merge it. */
	onSaved?: (avatar: { id: string; url: string } | null) => void;
	/** Replaces the direct save, for an entity that doesn't exist yet (a draft page). */
	persistAvatar?: (avatarImageId: string | null) => Promise<void>;
};

export function ClickableProfilePicture({ entity, canEdit = false, onSaved, persistAvatar }: ClickableProfilePictureProps) {
	const { run: saveProfile } = useAction(saveProfileAction);
	const [editOpen, setEditOpen] = useState(false);
	const [lightboxOpen, setLightboxOpen] = useState(false);

	const avatarUrl = entity.avatarImage?.url ?? null;

	// Avatar persists via a direct FK (not ImageAttachment): the profile save with
	// { fields: { avatarImageId } }. The action refreshes the page, so a server-rendered
	// avatar updates with it; `onSaved` is for a client-loaded profile that holds its own copy.
	async function saveAvatarImageId(avatarImageId: string | null) {
		if (persistAvatar) return persistAvatar(avatarImageId);
		const target: ProfileTarget = isCardPage(entity) ? { type: "page", id: entity.id } : { type: "user" };
		const result = await saveProfile({ target, payload: { fields: { avatarImageId } } });
		if (!result.ok) throw new Error(result.message ?? "Failed to save avatar");
	}

	function handlePhotoClick() {
		if (avatarUrl) {
			setLightboxOpen(true);
			return;
		}
		if (canEdit) setEditOpen(true);
	}

	const photo = (
		<ProfilePicture
			entity={entity}
			size="lg"
			asLink={false}
			className={`ring-4 ring-rich-brown ${avatarUrl || canEdit ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
		/>
	);

	return (
		<>
			<div className="relative inline-block">
				{avatarUrl || canEdit ? (
					<button
						type="button"
						onClick={handlePhotoClick}
						className="rounded-full focus:outline-none focus:ring-2 focus:ring-rich-brown"
						aria-label={avatarUrl ? "View profile photo" : "Add profile photo"}
					>
						{photo}
					</button>
				) : (
					photo
				)}
				{canEdit && avatarUrl && (
					<button
						type="button"
						onClick={() => setEditOpen(true)}
						className="absolute -bottom-1 -right-1 bg-black/50 hover:bg-black/70 text-white text-xs font-medium px-2 py-0.5 rounded-full"
					>
						Edit
					</button>
				)}
			</div>

			{lightboxOpen && avatarUrl && (
				<ImageLightbox src={avatarUrl} alt="Profile photo" onClose={() => setLightboxOpen(false)} />
			)}

			{canEdit && (
				<ImageEditModal
					isOpen={editOpen}
					onClose={() => setEditOpen(false)}
					title="Profile Photo"
					previewShape="round"
					existingImageUrl={avatarUrl}
					fallback={<GeneratedAvatar seed={entity.id} />}
					onSave={async ({ file }) => {
						if (!file) return;
						const image = await uploadImageOnly({ file, folder: "avatars" });
						await saveAvatarImageId(image.id);
						onSaved?.({ id: image.id, url: image.url });
					}}
					onRemove={async () => {
						await saveAvatarImageId(null);
						onSaved?.(null);
					}}
				/>
			)}
		</>
	);
}
