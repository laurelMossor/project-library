"use client";

import { useState, useEffect } from "react";
import { FormInput } from "../forms/FormInput";
import { FormField } from "../forms/FormField";
import { Button } from "../ui/Button";
import { FormError } from "../forms/FormError";

type AdminManagementProps = {
	orgId: string;
};

type Admin = {
	id: string;
	role: string;
	user: {
		id: string;
		username: string;
		firstName: string | null;
		lastName: string | null;
		displayName: string | null;
		avatarImageId: string | null;
	};
};

export function AdminManagement({ orgId }: AdminManagementProps) {
	const [admins, setAdmins] = useState<Admin[]>([]);
	const [loading, setLoading] = useState(true);
	const [adding, setAdding] = useState(false);
	const [username, setUsername] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		loadAdmins();
	}, [orgId]);

	const loadAdmins = async () => {
		try {
			const res = await fetch(`/api/orgs/${orgId}/admins`);
			if (res.ok) {
				const data = await res.json();
				setAdmins(data.admins || []);
			}
		} catch (err) {
			console.error("Failed to load admins:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleAddAdmin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setAdding(true);

		try {
			// First, find user by username
			const userRes = await fetch(`/api/users/by-username/${encodeURIComponent(username)}`);
			if (!userRes.ok) {
				setError("User not found");
				setAdding(false);
				return;
			}

			const userData = await userRes.json();
			const userId = userData.id;

			// Add as admin
			const res = await fetch(`/api/orgs/${orgId}/admins`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId }),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to add admin");
				setAdding(false);
				return;
			}

			setUsername("");
			await loadAdmins();
		} catch (err) {
			setError("Failed to add admin");
		} finally {
			setAdding(false);
		}
	};

	if (loading) {
		return <div className="bg-white border rounded-lg p-6">Loading admins...</div>;
	}

	return (
		<div className="bg-white border rounded-lg p-6">
			<h2 className="text-xl font-semibold mb-4">Admin Management</h2>
			
			<div className="mb-6">
				<h3 className="text-lg font-medium mb-3">Current Admins</h3>
				{admins.length === 0 ? (
					<p className="text-gray-500">No admins yet.</p>
				) : (
					<ul className="space-y-2">
						{admins.map((admin) => {
							const displayName = admin.user.displayName || 
								`${admin.user.firstName || ""} ${admin.user.lastName || ""}`.trim() || 
								admin.user.username;
							return (
								<li key={admin.id} className="flex items-center justify-between p-2 border rounded">
									<div>
										<p className="font-medium">{displayName}</p>
										<p className="text-sm text-gray-500">@{admin.user.username}</p>
									</div>
									<span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
										{admin.role}
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			<div className="border-t pt-6">
				<h3 className="text-lg font-medium mb-3">Add Admin</h3>
				<form onSubmit={handleAddAdmin} className="space-y-4">
					<FormError error={error} />
					<FormField label="Username" htmlFor="username">
						<FormInput
							id="username"
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="Enter username"
							required
						/>
					</FormField>
					<Button type="submit" disabled={adding || !username.trim()}>
						{adding ? "Adding..." : "Add Admin"}
					</Button>
				</form>
			</div>
		</div>
	);
}
