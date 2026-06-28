"use client";

import { ProfileSettingsBase } from "@/lib/components/profile/profile-settings/ProfileSettingsBase";
import { PublicPage } from "@/lib/types/page";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";
import { CONNECTIONS, PERSONAL_INFO } from "@/lib/const/routes";

const PAGE_DISABLED_BUTTONS = ["Privacy Settings", "Delete Page"];

type PageSettingsContentProps = {
	page: PublicPage;
	pages: PageItem[];
	publicProfileHref: string;
};

export function PageSettingsContent({
	page,
	pages,
	publicProfileHref,
}: PageSettingsContentProps) {
	return (
		<ProfileSettingsBase
			profileType="page"
			pages={pages}
			settingsTitle="Page Settings"
			avatarEntity={page}
			viewPublicProfileHref={`${publicProfileHref}?edit=true`}
			viewPublicProfileLabel="Edit Public Profile"
			disabledButtons={PAGE_DISABLED_BUTTONS}
			additionalSettingsButtons={
				<>
					<ButtonLink href={PERSONAL_INFO} variant="secondary" fullWidth>
						Edit Personal Information
					</ButtonLink>
					{/* Members & admins are managed in the Connections view (Membership tab). */}
					<ButtonLink href={CONNECTIONS} variant="secondary" fullWidth>
						Manage Members
					</ButtonLink>
				</>
			}
		/>
	);
}
