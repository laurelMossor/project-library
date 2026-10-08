"use client";

import { FEATURES } from "@/lib/const/features";
import { FieldLabel } from "./FieldLabel";
import { InlineTextField } from "./InlineTextField";
import { SettingsSection } from "./profile-settings/SettingsSection";
import type { PublicUser } from "@/lib/types/user";

/** What only the person sees: their email and real name. Never on the public profile. */
export function PersonalInfoSection({ user }: { user: PublicUser & { email?: string } }) {
	if (!FEATURES.privateDetails) return null;
	return (
		<SettingsSection title="Personal information">
			{user.email && (
				<div className="mb-4">
					<FieldLabel label="Email" visibility="private" />
					<p className="text-base text-warm-grey mt-1">{user.email}</p>
				</div>
			)}
			<div className="space-y-4">
				<InlineTextField name="firstName" label="First Name" original={user.firstName} placeholder="Add first name" visibility="private" optional />
				<InlineTextField name="middleName" label="Middle Name" original={user.middleName} placeholder="Add middle name" visibility="private" optional />
				<InlineTextField name="lastName" label="Last Name" original={user.lastName} placeholder="Add last name" visibility="private" optional />
			</div>
		</SettingsSection>
	);
}
