"use client";

import { type ReactNode } from "react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { BUG_REPORT_FORM } from "@/lib/const/routes";
import { SettingsSection } from "./SettingsSection";
import { UserPageSettings } from "./UserPageSettings";
import { PageItem } from "./PageSwitcher";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import type { CardEntity } from "@/lib/types/card";

type ProfileType = "user" | "page";

type ProfileSettingsBaseProps = {
	profileType: ProfileType;
	pages?: PageItem[];
	settingsTitle: string;
	avatarEntity?: CardEntity;
	viewPublicProfileHref: string;
	viewPublicProfileLabel?: string;
	additionalSettingsButtons?: ReactNode;
};

/**
 * Shared base component for profile settings pages (user and page).
 * Renders the settings action list only — profile editing happens inline
 * on the public profile page (/p/[slug] or /u/[username]).
 */
export function ProfileSettingsBase({
	profileType,
	pages,
	settingsTitle,
	avatarEntity,
	viewPublicProfileHref,
	viewPublicProfileLabel = "View Public Profile",
	additionalSettingsButtons,
}: ProfileSettingsBaseProps) {
	return (
		<SettingsSection
			title={settingsTitle}
			titleIcon={avatarEntity ? <ProfilePicture entity={avatarEntity} size="sm" asLink={false} /> : undefined}
		>
			<div className="flex flex-col gap-3">
				<ButtonLink href={viewPublicProfileHref} variant="secondary" fullWidth>
					{viewPublicProfileLabel}
				</ButtonLink>

				{additionalSettingsButtons}

				<ButtonLink href={BUG_REPORT_FORM} variant="secondary" fullWidth target="_blank" rel="noopener noreferrer">
					Report an Issue
				</ButtonLink>

				{profileType === "user" && <UserPageSettings pages={pages} />}
			</div>
		</SettingsSection>
	);
}
