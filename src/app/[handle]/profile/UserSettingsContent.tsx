"use client";

import { PublicUser } from "@/lib/types/user";
import { ProfileSettingsBase } from "@/lib/components/profile/profile-settings";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";

const USER_DISABLED_BUTTONS = [
	"Privacy Settings",
	"Change Password",
	"Delete Account",
];

type UserSettingsContentProps = {
	user: PublicUser;
	pages: PageItem[];
	publicProfileHref: string;
	connectionsHref: string;
};

export function UserSettingsContent({
	user: _user,
	pages,
	publicProfileHref,
	connectionsHref,
}: UserSettingsContentProps) {
	return (
		<ProfileSettingsBase
			profileType="user"
			pages={pages}
			settingsTitle="User Settings"
			viewPublicProfileHref={publicProfileHref}
			viewPublicProfileLabel="View & Edit Profile"
			disabledButtons={USER_DISABLED_BUTTONS}
			additionalSettingsButtons={
				<ButtonLink href={connectionsHref} variant="secondary" fullWidth>
					Manage Connections
				</ButtonLink>
			}
		/>
	);
}
