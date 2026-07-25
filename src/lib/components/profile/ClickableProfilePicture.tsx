"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardEntity, isCardPage } from "@/lib/types/card";
import { ProfilePicture } from "./ProfilePicture";
import { ImageEditModal } from "@/lib/components/images/ImageEditModal";
import { uploadImageOnly } from "@/lib/utils/image-client";
import { API_ME_USER, API_PAGE } from "@/lib/const/routes";
import { getUserInitials, getPageInitials } from "@/lib/utils/text";

type ClickableProfilePictureProps = {
	entity: CardEntity;
};

export function ClickableProfilePicture({ entity }: ClickableProfilePictureProps) {
	const router = useRouter();
	const [isModalOpen, setIsModalOpen] = useState(false);

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

	return (
		<>
			<button
				onClick={() => setIsModalOpen(true)}
				className="rounded-full focus:outline-none focus:ring-2 focus:ring-rich-brown"
				aria-label="Edit profile photo"
			>
				<ProfilePicture entity={entity} size="lg" asLink={false} className="ring-4 ring-rich-brown cursor-pointer hover:opacity-80 transition-opacity" />
			</button>

			<ImageEditModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
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
		</>
	);
}
