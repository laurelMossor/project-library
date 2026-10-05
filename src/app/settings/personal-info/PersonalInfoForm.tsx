"use client";

import { ActiveIdentityEditor } from "@/lib/components/profile/ActiveIdentityEditor";
import { AboutFields } from "@/lib/components/profile/AboutFields";
import { AddressSection } from "@/lib/components/profile/AddressSection";
import { EditableIdentityBlock } from "@/lib/components/profile/EditableIdentityBlock";
import { PersonalInfoSection } from "@/lib/components/profile/PersonalInfoSection";
import type { PublicUser } from "@/lib/types/user";

/**
 * The same sections setup shows, for an account or a page that already exists: identity,
 * public profile, then the private details last.
 */
export function PersonalInfoForm() {
	return (
		<ActiveIdentityEditor>
			{(entity, { merge }) => {
				const isUser = entity.type === "user";
				return (
					<div>
						<div className="mb-6">
							<h1 className="text-2xl font-bold">{isUser ? "Personal Info" : "Page Info"}</h1>
							<p className="text-sm text-gray-500 mt-1">
								{isUser
									? "Manage your personal information. Fields marked Public are visible on your profile; Private ones only you see."
									: "Manage your page information. Fields marked Public are visible on the page; Private ones only admins see."}
							</p>
						</div>
						<EditableIdentityBlock entity={entity} merge={merge} />
						<AboutFields
							headline={entity.data.headline}
							bio={entity.data.bio}
							location={entity.data.location}
							interests={entity.data.interests}
							bioPlaceholder={isUser ? "Tell people about yourself" : "Describe this page"}
						/>
						{entity.type === "user" ? (
							<PersonalInfoSection user={entity.data as PublicUser & { email?: string }} />
						) : (
							<AddressSection page={entity.data} />
						)}
					</div>
				);
			}}
		</ActiveIdentityEditor>
	);
}
