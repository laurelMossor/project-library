"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardEntity, isCardPage } from "@/lib/types/card";
import { ProfilePicture } from "./ProfilePicture";
import { ImageEditModal } from "@/lib/components/images/ImageEditModal";
import { ImageLightbox } from "@/lib/components/images/ImageLightbox";
import { uploadImageOnly } from "@/lib/utils/image-client";
import { API_ME_USER, API_PAGE } from "@/lib/const/routes";
import { getUserInitials, getPageInitials } from "@/lib/utils/text";

type ClickableProfilePictureProps = {
	entity: CardEntity;
	/** Owner can open the photo editor. Defaults false (public profiles). */
	canEdit?: boolean;
};

export function ClickableProfilePicture({ entity, canEdit = false }: ClickableProfilePictureProps) {
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);
	const [lightboxOpen, setLightboxOpen] = useState(false);

	const avatarUrl = entity.avatarImage?.url ?? null;
	const initials = isCardPage(entity) ? getPageInitials(entity.name) : getUserInitials(entity);

	// Avatar persists via a direct FK (not ImageAttachment): PUT the profile route
	// with { fields: { avatarImageId } }. Both user and page routes take the same wrapper.
	async function saveAvatarImageId(avatarImageId: string | null) {
		const endpoint = isCardPage(entity) ? API_PAGE(entity.id) : API_ME_USER;
		const res = await fetch(endpoint, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ fields: { avatarImageId } }),
		});
		if (!res.ok) throw new Error("Failed to save avatar");
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
					fallback={initials}
					onSave={async ({ file }) => {
						if (!file) return;
						const image = await uploadImageOnly({ file, folder: "avatars" });
						await saveAvatarImageId(image.id);
						router.refresh();
					}}
					onRemove={async () => {
						await saveAvatarImageId(null);
						router.refresh();
					}}
				/>
			)}
		</>
	);
}
