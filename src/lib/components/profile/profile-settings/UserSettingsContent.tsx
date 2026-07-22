"use client";

import { PublicUser } from "@/lib/types/user";
import { ProfileSettingsBase } from "@/lib/components/profile/profile-settings/ProfileSettingsBase";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";
import { CONNECTIONS, NOTIFICATIONS_SETTINGS, PERSONAL_INFO } from "@/lib/const/routes";

const USER_DISABLED_BUTTONS = ["Change Password", "Delete Account"];

type UserSettingsContentProps = {
	user: PublicUser;
	pages: PageItem[];
	publicProfileHref: string;
};

export function UserSettingsContent({
	user,
	pages,
	publicProfileHref,
}: UserSettingsContentProps) {
	return (
		<ProfileSettingsBase
			profileType="user"
			pages={pages}
			settingsTitle="User Settings"
			avatarEntity={user}
			viewPublicProfileHref={`${publicProfileHref}?edit=true`}
			viewPublicProfileLabel="Edit Public Profile"
			disabledButtons={USER_DISABLED_BUTTONS}
			additionalSettingsButtons={
				<>
					<ButtonLink href={PERSONAL_INFO} variant="secondary" fullWidth>
						Edit Personal Information
					</ButtonLink>
					<ButtonLink href={CONNECTIONS} variant="secondary" fullWidth>
						Manage Connections
					</ButtonLink>
					<ButtonLink href={NOTIFICATIONS_SETTINGS} variant="secondary" fullWidth>
						Email Notifications
					</ButtonLink>
				</>
			}
		/>
	);
}
