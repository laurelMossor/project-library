"use client";

import { useState } from "react";
import { PublicUser } from "@/lib/types/user";
import { EditableProfile } from "@/lib/components/user/EditableProfile";
import { ProfileSettingsBase } from "@/lib/components/profile-settings";
import { PUBLIC_USER_PAGE } from "@/lib/const/routes";
import type { PageItem } from "@/lib/components/profile-settings/PageSwitcher";

// User-specific disabled buttons
const USER_DISABLED_BUTTONS = [
	"Privacy Settings",
	"Change Password",
	"Delete Account",
	"Manage Followers",
];

type ProfileSettingsContentProps = {
	user: PublicUser;
	pages: PageItem[];
};

export function ProfileSettingsContent({ user, pages }: ProfileSettingsContentProps) {
	const [isEditing, setIsEditing] = useState(false);

	return (
		<ProfileSettingsBase
			profileType="user"
			pages={pages}
			settingsTitle="User Settings"
			viewPublicProfileHref={PUBLIC_USER_PAGE(user.username)}
			disabledButtons={USER_DISABLED_BUTTONS}
			onEditClick={() => setIsEditing(true)}
			isEditing={isEditing}
			profileContent={
				<EditableProfile
					user={user}
					isEditing={isEditing}
					onEditingChange={setIsEditing}
				/>
			}
		/>
	);
}
