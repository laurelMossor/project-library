"use client";

import { type ReactNode } from "react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { BUG_REPORT_FORM } from "@/lib/const/routes";
import { SettingsSection } from "./SettingsSection";
import { DisabledSettingsButton } from "./DisabledSettingsButton";
import { UserPageSettings } from "./UserPageSettings";
import { PageItem } from "./PageSwitcher";

type ProfileType = "user" | "page";

type ProfileSettingsBaseProps = {
	profileType: ProfileType;
	pages?: PageItem[];
	settingsTitle: string;
	viewPublicProfileHref: string;
	viewPublicProfileLabel?: string;
	disabledButtons?: string[];
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
	viewPublicProfileHref,
	viewPublicProfileLabel = "View Public Profile",
	disabledButtons = [],
	additionalSettingsButtons,
}: ProfileSettingsBaseProps) {
	return (
		<SettingsSection title={settingsTitle}>
			<div className="flex flex-col gap-3">
				<ButtonLink href={viewPublicProfileHref} variant="secondary" fullWidth>
					{viewPublicProfileLabel}
				</ButtonLink>

				{disabledButtons.map((label) => (
					<DisabledSettingsButton key={label}>{label}</DisabledSettingsButton>
				))}

				<ButtonLink href={BUG_REPORT_FORM} variant="secondary" fullWidth target="_blank" rel="noopener noreferrer">
					Report an Issue
				</ButtonLink>

				{additionalSettingsButtons}

				{profileType === "user" && <UserPageSettings pages={pages} />}
			</div>
		</SettingsSection>
	);
}
