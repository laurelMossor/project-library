"use client";

import { ManageConnections, ConnectionItem } from "./ManageConnections";

type ManageAdminsProps = {
	pageId: string;
};

/**
 * ManageAdmins - Specific implementation for managing page admins
 * Only page ADMINs can add/remove other admins
 */
export function ManageAdmins({ pageId }: ManageAdminsProps) {
	// Creators/primary admins should not be removable
	const canRemove = (item: ConnectionItem) => {
		return item.role !== "OWNER";
	};

	return (
		<ManageConnections
			targetType="page"
			targetId={pageId}
			connectionType="admins"
			title="Manage Admins"
			emptyMessage="No admins yet."
			addButtonLabel="Add Admin"
			addSearchPlaceholder="Enter username to add as admin"
			removeButtonLabel="Remove Admin"
			showRemoveButton={true}
			canRemove={canRemove}
			listEndpoint={`/api/pages/${pageId}/admins`}
			addEndpoint={`/api/pages/${pageId}/admins`}
			removeEndpoint={(memberId) => `/api/pages/${pageId}/admins/${memberId}`}
		/>
	);
}
