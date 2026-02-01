"use client";

import { useState } from "react";
import { PublicUser } from "@/lib/types/user";
import { EditableProfile } from "@/lib/components/user/EditableProfile";
import { ProfileSettingsBase, OrgItem } from "@/lib/components/profile-settings";
import { PUBLIC_USER_PAGE } from "@/lib/const/routes";

// User-specific disabled buttons
const USER_DISABLED_BUTTONS = [
	"Privacy Settings",
	"Change Password",
	"Delete Account",
	"Manage Followers",
	"Manage Orgs",
];

type ProfileSettingsContentProps = {
	user: PublicUser;
	orgs: OrgItem[];
};

export function ProfileSettingsContent({ user, orgs }: ProfileSettingsContentProps) {
	const [isEditing, setIsEditing] = useState(false);

	return (
		<ProfileSettingsBase
			ownerType="user"
			orgs={orgs}
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
