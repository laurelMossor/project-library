"use client";

import { useRef, ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { Button } from "@/lib/components/ui/Button";
import { ORG_NEW, BUG_REPORT_FORM, HOME, COLLECTIONS } from "@/lib/const/routes";
import { PeopleGroupIcon } from "@/lib/components/icons/icons";
import { SettingsSection } from "./SettingsSection";
import { DisabledSettingsButton } from "./DisabledSettingsButton";
import { LineDivider } from "../layout/LineDivider";
import { OrgSwitcher, OrgItem } from "./OrgSwitcher";

type OwnerType = "user" | "org";

type ProfileSettingsBaseProps = {
	ownerType: OwnerType;
	orgs: OrgItem[];
	// Settings section configuration
	settingsTitle: string;
	viewPublicProfileHref: string;
	viewPublicProfileLabel?: string;
	// Disabled buttons to show (user vs org may have different ones)
	disabledButtons?: string[];
	// Profile section
	profileSectionTitle?: string;
	profileContent: ReactNode;
	// Optional: custom settings buttons
	additionalSettingsButtons?: ReactNode;
	// For inline editing - callback when edit is clicked
	onEditClick?: () => void;
	isEditing?: boolean;
};

/**
 * Shared base component for profile settings pages (user and org)
 */
export function ProfileSettingsBase({
	ownerType,
	orgs,
	settingsTitle,
	viewPublicProfileHref,
	viewPublicProfileLabel = "View Public Profile",
	disabledButtons = [],
	profileSectionTitle = "Profile Information",
	profileContent,
	additionalSettingsButtons,
	onEditClick,
	isEditing = false,
}: ProfileSettingsBaseProps) {
	const profileSectionRef = useRef<HTMLDivElement>(null);

	const handleEditClick = () => {
		if (onEditClick) {
			onEditClick();
		}
		// Scroll to Profile Information section after a brief delay
		setTimeout(() => {
			profileSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		}, 50);
	};

	return (
		<>
			{/* Main Settings Section */}
			<SettingsSection title={settingsTitle}>
				<div className="flex flex-col gap-3">
					<ButtonLink href={viewPublicProfileHref} variant="secondary" fullWidth>
						{viewPublicProfileLabel}
					</ButtonLink>
					
					{onEditClick && (
						<Button
							onClick={handleEditClick}
							variant="secondary"
							fullWidth
							disabled={isEditing}
						>
							{isEditing ? "Editing Profile..." : "Edit Profile"}
						</Button>
					)}

					{/* Disabled buttons */}
					{disabledButtons.map((label) => (
						<DisabledSettingsButton key={label}>{label}</DisabledSettingsButton>
					))}

					<ButtonLink href={BUG_REPORT_FORM} variant="secondary" fullWidth target="_blank" rel="noopener noreferrer">
						Report an Issue
					</ButtonLink>

					{additionalSettingsButtons}

					{/* Org Settings Section */}
					<LineDivider />
					<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
						<PeopleGroupIcon className="w-6 h-6 shrink-0" /> Org Settings
					</h2>
					<div className="flex flex-col gap-3">
						<ButtonLink href={ORG_NEW} variant="secondary" fullWidth>
							Create a Group, Organization, or Public Entity
						</ButtonLink>
						<OrgSwitcher orgs={orgs} showSwitchToUser={ownerType === "org"} />
					</div>
				</div>
			</SettingsSection>

			{/* Profile Information Section */}
			<SettingsSection>
				<div ref={profileSectionRef}>
					<h2 className="text-xl font-semibold mb-4">{profileSectionTitle}</h2>
					{profileContent}
				</div>
			</SettingsSection>

			{/* Footer Links */}
			<div className="flex gap-4 justify-center">
				<Link href={HOME} className="text-sm underline text-gray-600">Home</Link>
				<Link href={COLLECTIONS} className="text-sm underline text-gray-600">Collections</Link>
			</div>
		</>
	);
}
