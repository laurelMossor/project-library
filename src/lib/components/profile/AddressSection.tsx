"use client";

import { FEATURES } from "@/lib/const/features";
import { InlineTextField } from "./InlineTextField";
import { SettingsSection } from "./profile-settings/SettingsSection";
import type { PublicPage } from "@/lib/types/page";

/** A page's mailing address. Kept private; every part is optional. */
export function AddressSection({ page }: { page: PublicPage }) {
	if (!FEATURES.privateDetails) return null;
	return (
		<SettingsSection title="Address">
			<div className="space-y-4">
				<InlineTextField name="addressLine1" label="Address Line 1" original={page.addressLine1} placeholder="Street address" maxLength={200} visibility="private" optional />
				<InlineTextField name="addressLine2" label="Address Line 2" original={page.addressLine2} placeholder="Apt, suite, etc." maxLength={200} visibility="private" optional />
				<InlineTextField name="city" label="City" original={page.city} placeholder="City" visibility="private" optional />
				<InlineTextField name="state" label="State" original={page.state} placeholder="State" maxLength={50} visibility="private" optional />
				<InlineTextField name="zip" label="Zip" original={page.zip} placeholder="Zip" maxLength={20} visibility="private" optional />
			</div>
		</SettingsSection>
	);
}
