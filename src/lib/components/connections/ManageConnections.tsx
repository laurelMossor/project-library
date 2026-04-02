"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/lib/components/ui/Button";
import { ConnectionListItem, ConnectionUser } from "./ConnectionListItem";
import { AddConnectionSearch } from "./AddConnectionSearch";
import { ConnectionType } from "@/lib/types/card";

export type { ConnectionType } from "@/lib/types/card";

export type ConnectionItem = {
	id: string; // membership/follow id
	userId: string;
	role?: string;
	user: ConnectionUser;
};

type ManageConnectionsProps = {
	// Target entity - the page or user whose connections we're managing
	targetType: "page" | "user";
	targetId: string;
	// What type of connections we're managing
	connectionType: ConnectionType;
	// Title to display
	title: string;
	// Empty state message
	emptyMessage?: string;
	// Add button configuration
	addButtonLabel?: string;
	addSearchPlaceholder?: string;
	// Remove button configuration
	removeButtonLabel?: string;
	// Whether to show the remove button (can be controlled per-item via canRemove)
	showRemoveButton?: boolean;
	// Custom function to check if a specific item can be removed
	canRemove?: (item: ConnectionItem) => boolean;
	// API endpoints (allows customization for different connection types)
	listEndpoint: string;
	addEndpoint?: string;
	removeEndpoint?: (itemId: string) => string;
	// Callbacks
	onListLoaded?: (items: ConnectionItem[]) => void;
};

/**
 * ManageConnections - Base component for managing various connection types
 * Handles permission checking, list display, and add/remove functionality
 */
export function ManageConnections({
	targetType,
	targetId,
	connectionType,
	title,
	emptyMessage = "No connections yet.",
	addButtonLabel = "Add",
	addSearchPlaceholder = "Enter username",
	removeButtonLabel = "Remove",
	showRemoveButton = true,
	canRemove,
	listEndpoint,
	addEndpoint,
	removeEndpoint,
	onListLoaded,
}: ManageConnectionsProps) {
	const { data: session } = useSession();
	const [items, setItems] = useState<ConnectionItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showAddForm, setShowAddForm] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [hasPermission, setHasPermission] = useState(false);

	// Check if the current user has permission to manage this list
	const checkPermission = useCallback(async () => {
		if (!session?.user?.id) {
			setHasPermission(false);
			return;
		}

		// For page admins, verify the user has the ADMIN role on this page
		if (targetType === "page" && connectionType === "admins") {
			try {
				const res = await fetch(listEndpoint);
				if (!res.ok) {
					setHasPermission(false);
					return;
				}
				const data = await res.json();
				const admins = data.admins || [];
				
				// Check if current user is an ADMIN of this page
				const isAdmin = admins.some(
					(admin: ConnectionItem) =>
						admin.user?.id === session.user.id && admin.role === "ADMIN"
				);
				setHasPermission(isAdmin);
			} catch {
				setHasPermission(false);
			}
		} else if (targetType === "user") {
			// For user connections (followers/following), check if it's the user's own profile
			// The session user's userId should match
			setHasPermission(session.user.id === targetId);
		} else {
			setHasPermission(false);
		}
	}, [session, targetType, targetId, connectionType, listEndpoint]);

	// Load the connection list
	const loadItems = useCallback(async () => {
		try {
			const res = await fetch(listEndpoint);
			if (!res.ok) {
				setError("Failed to load connections");
				setLoading(false);
				return;
			}
			const data = await res.json();
			
			// Map response to our format based on connection type
			let loadedItems: ConnectionItem[] = [];
			
			if (connectionType === "admins") {
				loadedItems = (data.admins || []).map((admin: { id: string; userId: string; role: string; user: ConnectionUser }) => ({
					id: admin.id,
					userId: admin.userId,
					role: admin.role,
					user: admin.user,
				}));
			} else if (connectionType === "followers" || connectionType === "following") {
				const list = data.followers || data.following || [];
				loadedItems = list.map((item: { userId: string; user: ConnectionUser }) => ({
					id: item.userId,
					userId: item.userId,
					user: item.user,
				}));
			}

			setItems(loadedItems);
			onListLoaded?.(loadedItems);
		} catch {
			setError("Failed to load connections");
		} finally {
			setLoading(false);
		}
	}, [listEndpoint, connectionType, onListLoaded]);

	useEffect(() => {
		checkPermission();
		loadItems();
	}, [checkPermission, loadItems]);

	const handleAdd = async (userId: string) => {
		if (!addEndpoint) return;

		setError("");
		
		try {
			const res = await fetch(addEndpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId }),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to add");
				throw new Error(data.error || "Failed to add");
			}

			await loadItems();
		} catch (err) {
			if (err instanceof Error) {
				setError(err.message);
			}
			throw err;
		}
	};

	const handleRemove = async (itemId: string) => {
		if (!removeEndpoint) return;

		setRemovingId(itemId);
		setError("");

		try {
			const res = await fetch(removeEndpoint(itemId), {
				method: "DELETE",
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Failed to remove");
				setRemovingId(null);
				return;
			}

			await loadItems();
		} catch {
			setError("Failed to remove");
		} finally {
			setRemovingId(null);
		}
	};

	// If user doesn't have permission, show read-only view
	if (!hasPermission && !loading) {
		return (
			<div className="bg-white border rounded-lg p-6">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-gray-500 text-sm mb-4">
					You don&apos;t have permission to manage this list.
				</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="bg-white border rounded-lg p-6">
				<h2 className="text-xl font-semibold mb-4">{title}</h2>
				<p className="text-gray-500">Loading...</p>
			</div>
		);
	}

	return (
		<div className="bg-white border rounded-lg p-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-xl font-semibold">
					{title} ({items.length})
				</h2>
				{addEndpoint && hasPermission && (
					<Button
						onClick={() => setShowAddForm(true)}
						variant="secondary"
						size="sm"
						disabled={showAddForm}
					>
						{addButtonLabel}
					</Button>
				)}
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
					{error}
				</div>
			)}

			<AddConnectionSearch
				onAdd={handleAdd}
				placeholder={addSearchPlaceholder}
				buttonLabel={addButtonLabel}
				isOpen={showAddForm}
				onClose={() => setShowAddForm(false)}
			/>

			{items.length === 0 ? (
				<p className="text-gray-500 mt-4">{emptyMessage}</p>
			) : (
				<div className="space-y-2 mt-4">
					{items.map((item) => {
						const canRemoveItem = canRemove ? canRemove(item) : true;
						const shouldShowRemove = showRemoveButton && canRemoveItem && removeEndpoint;

						return (
							<ConnectionListItem
								key={item.id}
								user={item.user}
								role={item.role}
								onRemove={shouldShowRemove ? () => handleRemove(item.id) : undefined}
								removing={removingId === item.id}
								showRemoveButton={!!shouldShowRemove}
								removeButtonLabel={removeButtonLabel}
							/>
						);
					})}
				</div>
			)}
		</div>
	);
}
