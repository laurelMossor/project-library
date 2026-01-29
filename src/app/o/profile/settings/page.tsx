/**
 * ORG PROFILE SETTINGS PAGE
 * 
 * This is the org's settings page at /o/profile/settings.
 * - Protected route (requires authentication)
 * - Allows switching between user and org owners
 * - Links to edit pages
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { Button } from "@/lib/components/ui/Button";
import { AdminManagement } from "@/lib/components/org/AdminManagement";
import { LOGIN_WITH_CALLBACK, HOME, API_ME_ORGS, ORG_PROFILE_SETTINGS, API_ME_OWNER, PRIVATE_ORG_PAGE, PRIVATE_USER_PAGE, USER_PROFILE_EDIT, ORG_PROFILE_EDIT } from "@/lib/const/routes";

interface Org {
	id: string;
	name: string;
	slug: string;
	ownerId: string;
}

export default function OrgSettingsPage() {
	const { data: session, update: updateSession } = useSession();
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [orgs, setOrgs] = useState<Org[]>([]);
	const [switching, setSwitching] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!session?.user?.id) {
			router.push(LOGIN_WITH_CALLBACK("/o/profile/settings"));
			return;
		}

		// Fetch user's orgs
		fetch(API_ME_ORGS)
			.then((res) => {
				if (res.status === 401) {
					router.push(LOGIN_WITH_CALLBACK(ORG_PROFILE_SETTINGS));
					return;
				}
				return res.json();
			})
			.then((data) => {
				if (data && !data.error) {
					setOrgs(data);
				}
				setLoading(false);
			})
			.catch(() => {
				setError("Failed to load organizations");
				setLoading(false);
			});
	}, [session, router]);

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
		} catch (err) {
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

			// Update session to clear activeOwnerId (reverts to personal owner)
			await updateSession({ activeOwnerId: null });
			
			// Redirect to user profile
			router.push(PRIVATE_USER_PAGE);
		} catch (err) {
			setError("Failed to switch to user");
			setSwitching(false);
		}
	};

	if (loading) {
		return (
			<CenteredLayout maxWidth="2xl">
				<div>Loading...</div>
			</CenteredLayout>
		);
	}

	const activeOwnerId = session?.user?.activeOwnerId;
	// Find the active org by matching ownerId
	const activeOrg = orgs.find(org => org.ownerId === activeOwnerId);

	return (
		<CenteredLayout maxWidth="2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2">Org Settings</h1>
				<p className="text-gray-600">Manage organization settings and switch between user and organization profiles</p>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
					{error}
				</div>
			)}

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Current Owner</h2>
				{activeOrg ? (
					<div className="space-y-3">
						<p className="text-sm text-gray-600">You are currently acting as an organization.</p>
						<Button
							onClick={handleSwitchToUser}
							disabled={switching}
							loading={switching}
							variant="secondary"
						>
							Switch to User Profile
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						<p className="text-sm text-gray-600">You are currently acting as your user account.</p>
						<p className="text-sm text-gray-500">Select an organization below to switch to its profile.</p>
					</div>
				)}
			</div>

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Organizations</h2>
				{orgs.length === 0 ? (
					<p className="text-sm text-gray-600">You don't belong to any organizations yet.</p>
				) : (
					<div className="space-y-3">
						<p className="text-sm text-gray-600 mb-4">Switch to an organization profile to manage it:</p>
						{orgs.map((org) => (
							<div key={org.id} className="flex items-center justify-between p-3 border rounded">
								<div>
									<p className="font-medium">{org.name}</p>
									<p className="text-sm text-gray-500">@{org.slug}</p>
								</div>
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
						))}
					</div>
				)}
			</div>

			{activeOrg && (
				<div className="mb-6">
					<AdminManagement orgId={activeOrg.id} />
				</div>
			)}

			<div className="bg-white border rounded-lg p-6 mb-6">
				<h2 className="text-xl font-semibold mb-4">Quick Links</h2>
				<div className="flex flex-col gap-3">
					<ButtonLink href={PRIVATE_USER_PAGE} variant="secondary" fullWidth>
						User Profile
					</ButtonLink>
					<ButtonLink href={USER_PROFILE_EDIT} variant="secondary" fullWidth>
						Edit User Profile
					</ButtonLink>
					{activeOrg && (
						<>
							<ButtonLink href={PRIVATE_ORG_PAGE} variant="secondary" fullWidth>
								Org Profile
							</ButtonLink>
							<ButtonLink href={ORG_PROFILE_EDIT} variant="secondary" fullWidth>
								Edit Org Profile
							</ButtonLink>
						</>
					)}
				</div>
			</div>

			<div className="flex gap-4 justify-center">
				<a href={HOME} className="text-sm underline text-gray-600">Home</a>
			</div>
		</CenteredLayout>
	);
}
