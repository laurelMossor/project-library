"use client";

import { useState } from "react";
import { CardEntity, isCardPage } from "@/lib/types/card";
import { ProfilePicture } from "./ProfilePicture";
import { AvatarEditModal } from "./AvatarEditModal";
import { getUserInitials, getPageInitials } from "@/lib/utils/text";

type ClickableProfilePictureProps = {
	entity: CardEntity;
};

export function ClickableProfilePicture({ entity }: ClickableProfilePictureProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);

	const avatarUrl = entity.avatarImage?.url ?? null;
	const initials = isCardPage(entity) ? getPageInitials(entity.name) : getUserInitials(entity);

	return (
		<>
			<button
				onClick={() => setIsModalOpen(true)}
				className="rounded-full focus:outline-none focus:ring-2 focus:ring-rich-brown"
				aria-label="Edit profile photo"
			>
				<ProfilePicture entity={entity} size="lg" asLink={false} className="ring-4 ring-rich-brown cursor-pointer hover:opacity-80 transition-opacity" />
			</button>

			<AvatarEditModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				currentAvatarUrl={avatarUrl}
				initials={initials}
			/>
		</>
	);
}
