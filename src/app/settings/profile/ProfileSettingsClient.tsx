"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
import { authFetch } from "@/lib/utils/auth-client";
import { API_ME_USER, API_ME_PAGE, SETTINGS } from "@/lib/const/routes";
import { isAdminRole } from "@/lib/const/roles";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { PublicUser } from "@/lib/types/user";
import type { PublicPage } from "@/lib/types/page";

type EntityData =
	| { type: "user"; data: PublicUser }
	| { type: "page"; data: PublicPage };

/**
 * The consolidated "Profile Settings" page: profile visibility, content visibility, and email
 * notifications on one page. The two visibility controls live in a single InlineEditSession (shared
 * Save bar + PRIVATE≠LISTED guard) and save to /api/me/user|page; changing a Page's visibility is
 * ADMIN-only, so a non-admin editor sees only the notifications section. Notification preferences
 * keep their own per-toggle autosave, so that form sits outside the session.
 */
export function ProfileSettingsClient() {
	const { activePageId, pages, loading: profileLoading } = useActiveProfile();
	const [entityData, setEntityData] = useState<EntityData | null>(null);
	const [loading, setLoading] = useState(true);

	const isPage = !!activePageId;

	// Load (and reload on identity switch) the active profile's visibility fields.
	useEffect(() => {
		setLoading(true);
		const url = isPage ? API_ME_PAGE : API_ME_USER;
		fetch(url)
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				setEntityData(data ? (isPage ? { type: "page", data } : { type: "user", data }) : null);
			})
			.finally(() => setLoading(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activePageId]);

	// Changing a page's visibility is ADMIN-only (server also enforces via saveMyProfile). A user
	// always controls their own visibility.
	const activePageRole = pages.find((p) => p.id === activePageId)?.role;
	const canEditVisibility = !isPage || isAdminRole(activePageRole);

	const saveUrl = isPage ? API_ME_PAGE : API_ME_USER;

	const handleSave = async (payload: SavePayload) => {
		const res = await authFetch(saveUrl, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.error || "Failed to save");
		}
		return res.json();
	};

	if (profileLoading || loading) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Profile Settings</h1>
				<p className="text-sm text-gray-500 mt-1">
					Control who can see your profile and content, and manage your email notifications.
				</p>
			</div>

			{entityData && canEditVisibility && (
				<InlineEditSession
					resource={entityData.data as unknown as Record<string, unknown>}
					onSave={handleSave as (payload: SavePayload) => Promise<Record<string, unknown> | void>}
					onSaved={(updated) =>
						setEntityData((prev) => {
							if (!prev) return prev;
							return prev.type === "user"
								? { type: "user", data: { ...prev.data, ...(updated as Partial<PublicUser>) } }
								: { type: "page", data: { ...prev.data, ...(updated as Partial<PublicPage>) } };
						})
					}
					canEdit={true}
				>
					<VisibilityField
						profileSectionTitle={entityData.type === "page" ? "Page Visibility" : "Profile Visibility"}
						contentSectionTitle="Content Visibility"
						initialProfileVisibility={entityData.data.profileVisibility ?? "PUBLIC"}
						initialContentVisibility={entityData.data.contentVisibility ?? "LISTED"}
					/>
				</InlineEditSession>
			)}

			<SettingsSection title="Email Notifications">
				<NotificationSettingsForm />
			</SettingsSection>

			<div className="mt-6 flex justify-center">
				<Link href={SETTINGS} className="text-sm underline text-gray-600">Back to Settings</Link>
			</div>
		</div>
	);
}
