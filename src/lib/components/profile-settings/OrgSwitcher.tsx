"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/lib/components/ui/Button";
import { OrgCard } from "@/lib/components/cards/OrgCard";
import { API_ME_OWNER, PRIVATE_ORG_PAGE, PRIVATE_USER_PAGE } from "@/lib/const/routes";

export type OrgItem = {
	id: string;
	name: string;
	slug: string;
	ownerId: string;
	avatarImageId?: string | null;
};

type OrgSwitcherProps = {
	orgs?: OrgItem[] | null;
	showSwitchToUser?: boolean;
};

/**
 * Component for displaying and switching between organizations
 */
export function OrgSwitcher({ orgs, showSwitchToUser = false }: OrgSwitcherProps) {
	const { data: session, update: updateSession } = useSession();
	const router = useRouter();
	const [switching, setSwitching] = useState(false);
	const [error, setError] = useState("");

	const activeOwnerId = session?.user?.activeOwnerId;

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

	const handleSwitchToUser = async () => {
		setSwitching(true);
		setError("");

		try {
			const res = await fetch(API_ME_OWNER, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerId: null }),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to switch to user");
				setSwitching(false);
				return;
			}

			// Update session to clear activeOwnerId
			await updateSession({ activeOwnerId: null });
			
			// Redirect to user profile
			router.push(PRIVATE_USER_PAGE);
		} catch {
			setError("Failed to switch to user");
			setSwitching(false);
		}
	};

	if (!orgs) {
		return (
			<p className="text-sm text-gray-500 italic">You don&apos;t belong to any organizations yet.</p>
		);
	}

	return (
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
				{orgs.map((org) => {
					const isActive = activeOwnerId === org.ownerId;
					return (
						<OrgCard
							key={org.id}
							org={{
								id: org.id,
								name: org.name,
								slug: org.slug,
								avatarImageId: org.avatarImageId ?? null,
							}}
							badge={isActive ? "Active" : undefined}
							actions={
								<Button
									onClick={() => handleSwitchToOrg(org.ownerId)}
									disabled={switching || isActive}
									loading={switching}
									variant="secondary"
									size="sm"
								>
									{isActive ? "Active" : "Switch To"}
								</Button>
							}
						/>
					);
				})}
			</div>
			{showSwitchToUser && activeOwnerId && (
				<div className="mt-4 pt-4 border-t">
					<Button
						onClick={handleSwitchToUser}
						disabled={switching}
						loading={switching}
						variant="secondary"
						fullWidth
					>
						Switch to User Profile
					</Button>
				</div>
			)}
		</div>
	);
}
