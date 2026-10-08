"use client";

import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { PageMembershipSettings } from "@/lib/components/profile/PageMembershipSettings";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
import { ActiveIdentityEditor } from "@/lib/components/profile/ActiveIdentityEditor";
import { isAdminRole } from "@/lib/const/roles";

/**
 * Profile visibility, content visibility, and email notifications. Visibility lives in the
 * shared identity editor (Save bar + PRIVATE≠LISTED guard). Changing a page's visibility is
 * ADMIN-only, so a non-admin editor sees only the notifications section. Notification
 * preferences keep their own per-toggle autosave, outside the session.
 */
export function ProfileSettingsClient() {
	const { activePageId, activeRole } = useActiveProfile();
	const isPage = !!activePageId;
	// The role comes from the acting identity the layout already resolved. The switcher
	// list (`pages`) stays empty until that menu opens, so reading the role from it hid
	// these sections on a direct visit to settings.
	const canEditVisibility = !isPage || isAdminRole(activeRole);

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Profile Settings</h1>
				<p className="text-sm text-gray-500 mt-1">
					Control who can see your profile and content, and manage your email notifications.
				</p>
			</div>

			{canEditVisibility && (
				<ActiveIdentityEditor>
					{(entity) => (
						<>
							<VisibilityField
								profileSectionTitle={entity.type === "page" ? "Page Visibility" : "Profile Visibility"}
								contentSectionTitle="Content Visibility"
								initialProfileVisibility={entity.data.profileVisibility ?? "PUBLIC"}
								initialContentVisibility={entity.data.contentVisibility ?? "LISTED"}
							/>
							{entity.type === "page" && (
								<PageMembershipSettings
									initialPolicy={entity.data.membershipPolicy ?? "CLOSED"}
									initialAllowMemberPosts={entity.data.allowMemberPosts ?? false}
								/>
							)}
						</>
					)}
				</ActiveIdentityEditor>
			)}

			<SettingsSection title="Email Notifications">
				<NotificationSettingsForm />
			</SettingsSection>
		</div>
	);
}
