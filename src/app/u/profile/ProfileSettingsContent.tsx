"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PublicUser } from "@/lib/types/user";
import { EditableProfile } from "@/lib/components/user/EditableProfile";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { Button } from "@/lib/components/ui/Button";
import { PUBLIC_USER_PAGE, ORG_NEW, BUG_REPORT_FORM, PUBLIC_ORG_PAGE, API_ME_OWNER, PRIVATE_ORG_PAGE } from "@/lib/const/routes";
import { PeopleGroupIcon } from "@/lib/components/icons/icons";

// Disabled button component for mocked/upcoming features
function DisabledSettingsButton({ children }: { children: React.ReactNode }) {
	return (
		<button
			disabled
			className="w-full px-4 py-2 text-left rounded border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed flex items-center justify-between"
		>
			<span>{children}</span>
			<span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Coming Soon</span>
		</button>
	);
}

// Simple horizontal line divider
function LineDivider() {
	return <hr className="my-6 border-t border-gray-200" />;
}

type Org = {
	id: string;
	name: string;
	slug: string;
	ownerId: string;
};

type ProfileSettingsContentProps = {
	user: PublicUser;
	orgs: Org[];
};

export function ProfileSettingsContent({ user, orgs }: ProfileSettingsContentProps) {
	const { data: session, update: updateSession } = useSession();
	const router = useRouter();
	const [isEditing, setIsEditing] = useState(false);
	const [switching, setSwitching] = useState(false);
	const [error, setError] = useState("");
	const profileSectionRef = useRef<HTMLDivElement>(null);

	const activeOwnerId = session?.user?.activeOwnerId;

	const handleEditClick = () => {
		setIsEditing(true);
		// Scroll to Profile Information section after a brief delay to ensure state updates
		setTimeout(() => {
			profileSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		}, 50);
	};

	const handleSwitchToOrg = async (orgOwnerId: string) => {
		setSwitching(true);
		setError("");

		try {
			const res = await fetch(API_ME_OWNER, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerId: orgOwnerId }),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to switch to organization");
				setSwitching(false);
				return;
			}

			// Update session with new activeOwnerId
			await updateSession({ activeOwnerId: orgOwnerId });
			
			// Redirect to org profile
			router.push(PRIVATE_ORG_PAGE);
		} catch {
			setError("Failed to switch to organization");
			setSwitching(false);
		}
	};

	return (
		<>
			{/* User Settings Section */}
			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">User Settings</h2>
				<div className="flex flex-col gap-3">
					<ButtonLink href={PUBLIC_USER_PAGE(user.username)} variant="secondary" fullWidth>
						View Public Profile
					</ButtonLink>
					<Button
						onClick={handleEditClick}
						variant="secondary"
						fullWidth
						disabled={isEditing}
					>
						{isEditing ? "Editing Profile..." : "Edit Profile"}
					</Button>
					<DisabledSettingsButton>Privacy Settings</DisabledSettingsButton>
					<DisabledSettingsButton>Change Password</DisabledSettingsButton>
					<DisabledSettingsButton>Delete Account</DisabledSettingsButton>
					<ButtonLink href={BUG_REPORT_FORM} variant="secondary" fullWidth target="_blank" rel="noopener noreferrer">
						Report an Issue
					</ButtonLink>
					<DisabledSettingsButton>Manage Followers</DisabledSettingsButton>
					<DisabledSettingsButton>Manage Orgs</DisabledSettingsButton>
				
				{/* Org Settings Section */}
				<LineDivider />
				<h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><PeopleGroupIcon className="w-6 h-6 shrink-0" /> Org Settings</h2>
				<div className="flex flex-col gap-3">
					<ButtonLink href={ORG_NEW} variant="secondary" fullWidth>
						Create a Group, Organization, or Public Entity
					</ButtonLink>
					
					{orgs.length > 0 && (
						<div className="mt-4">
							<p className="text-sm text-gray-600 mb-3">
								Your organizations <span className="text-xs text-gray-400">(To edit admins, go to the org profile)</span>
							</p>
							{error && (
								<div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-sm">
									{error}
								</div>
							)}
							<div className="space-y-2">
								{orgs.map((org) => (
									<div
										key={org.id}
										className="flex items-center justify-between p-3 border rounded"
									>
										<div>
											<p className="font-medium">{org.name}</p>
											<p className="text-sm text-gray-500">@{org.slug}</p>
										</div>
										<div className="flex gap-2">
											<ButtonLink
												href={PUBLIC_ORG_PAGE(org.slug)}
												variant="tertiary"
												size="sm"
											>
												View
											</ButtonLink>
											<Button
												onClick={() => handleSwitchToOrg(org.ownerId)}
												disabled={switching || activeOwnerId === org.ownerId}
												loading={switching}
												variant="secondary"
												size="sm"
											>
												{activeOwnerId === org.ownerId ? "Active" : "Switch To"}
											</Button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
					
					{orgs.length === 0 && (
						<p className="text-sm text-gray-500 italic">You don&apos;t belong to any organizations yet.</p>
					)}
				</div>
				</div>
			</div>

			{/* Profile Information Section */}
			<div ref={profileSectionRef} className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Profile Information</h2>
				<EditableProfile 
					user={user} 
					isEditing={isEditing}
					onEditingChange={setIsEditing}
				/>
			</div>
		</>
	);
}
