"use client";

import { PublicUser } from "@/lib/types/user";
import { ProfileSettingsBase } from "@/lib/components/profile/profile-settings";
import { PUBLIC_USER_PAGE, USER_CONNECTIONS } from "@/lib/const/routes";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";

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
	return (
		<ProfileSettingsBase
			profileType="user"
			pages={pages}
			settingsTitle="User Settings"
			viewPublicProfileHref={PUBLIC_USER_PAGE(user.username)}
			viewPublicProfileLabel="View & Edit Profile"
			disabledButtons={USER_DISABLED_BUTTONS}
			additionalSettingsButtons={
				<ButtonLink href={USER_CONNECTIONS} variant="secondary" fullWidth>
					Manage Connections
				</ButtonLink>
			}
		/>
	);
}
