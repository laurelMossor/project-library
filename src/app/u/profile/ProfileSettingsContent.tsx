"use client";

import { useState } from "react";
import { PublicUser } from "@/lib/types/user";
import { EditableProfile } from "@/lib/components/user/EditableProfile";
import { ProfileSettingsBase } from "@/lib/components/profile/profile-settings";
import { PUBLIC_USER_PAGE, USER_CONNECTIONS } from "@/lib/const/routes";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";

// User-specific disabled buttons
const USER_DISABLED_BUTTONS = [
	"Privacy Settings",
	"Change Password",
	"Delete Account",
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
			additionalSettingsButtons={
				<ButtonLink href={USER_CONNECTIONS(user.username)} variant="secondary" fullWidth>
					Manage Connections
				</ButtonLink>
			}
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
