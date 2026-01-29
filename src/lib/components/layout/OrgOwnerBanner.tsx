"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { API_ME_OWNER, API_ME_ORG } from "@/lib/const/routes";

/**
 * OrgOwnerBanner
 * Displays a banner when user is acting as an org
 * Shows "Acting as [Org Name]" with option to switch back to user
 */
export function OrgOwnerBanner() {
	const { data: session, update: updateSession } = useSession();
	const router = useRouter();
	const [orgName, setOrgName] = useState<string | null>(null);
	const [switching, setSwitching] = useState(false);

	const activeOwnerId = session?.user?.activeOwnerId;

	// Fetch org name when activeOwnerId changes
	useEffect(() => {
		if (!activeOwnerId) {
			setOrgName(null);
			return;
		}

		fetch(API_ME_ORG)
			.then((res) => {
				if (res.ok) {
					return res.json();
				}
				return null;
			})
			.then((data) => {
				if (data && data.name) {
					setOrgName(data.name);
				}
			})
			.catch(() => {
				// Silently fail - banner just won't show org name
			});
	}, [activeOwnerId]);

	if (!activeOwnerId || !orgName) {
		return null;
	}

	const handleSwitchToUser = async () => {
		setSwitching(true);

		try {
			const res = await fetch(API_ME_OWNER, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerId: null }),
			});

			if (res.ok) {
				// Update session to clear activeOwnerId
				await updateSession({ activeOwnerId: null });
				router.push("/u/profile");
			}
		} catch (err) {
			// Silently fail
		} finally {
			setSwitching(false);
		}
	};

	return (
		<div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
			<div className="max-w-7xl mx-auto flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="text-sm text-blue-800">
						Acting as <strong>{orgName}</strong>
					</span>
				</div>
				<Button
					onClick={handleSwitchToUser}
					disabled={switching}
					loading={switching}
					variant="secondary"
					size="sm"
				>
					Switch to User
				</Button>
			</div>
		</div>
	);
}
