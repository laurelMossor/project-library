"use client";

import { ProfileSettingsBase } from "@/lib/components/profile/profile-settings/ProfileSettingsBase";
import { PublicPage } from "@/lib/types/page";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";
import { FEATURES } from "@/lib/const/features";
import { CONNECTIONS, PROFILE_SETTINGS, PERSONAL_INFO } from "@/lib/const/routes";
import { isAdminRole } from "@/lib/const/roles";
import { DeletePageButton } from "./DeletePageButton";

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
			viewPublicProfileLabel="Edit profile page"
			additionalSettingsButtons={
				<>
					{FEATURES.privateDetails && (
						<ButtonLink href={PERSONAL_INFO} variant="secondary" fullWidth>
							Edit Personal Information
						</ButtonLink>
					)}
					{/* Members & admins are managed in the Connections view (Members tab). */}
					<ButtonLink href={CONNECTIONS} variant="secondary" fullWidth>
						Connections
					</ButtonLink>
					<ButtonLink href={PROFILE_SETTINGS} variant="secondary" fullWidth>
						Privacy &amp; notifications
					</ButtonLink>
					{isAdminRole(pages.find((item) => item.id === page.id)?.role) && (
						<DeletePageButton pageId={page.id} pageName={page.name} />
					)}
				</>
			}
		/>
	);
}
