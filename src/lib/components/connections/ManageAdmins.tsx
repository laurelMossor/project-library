"use client";

import { ManageConnections, ConnectionItem } from "./ManageConnections";

type ManageAdminsProps = {
	orgId: string;
};

/**
 * ManageAdmins - Specific implementation for managing org admins
 * Only org OWNERs can add/remove admins
 * OWNERs cannot be removed (only ADMINs can be removed)
 */
export function ManageAdmins({ orgId }: ManageAdminsProps) {
	// Owners cannot be removed from the admin list
	const canRemove = (item: ConnectionItem) => {
		return item.role !== "OWNER";
	};

	return (
		<ManageConnections
			targetType="org"
			targetId={orgId}
			connectionType="admins"
			title="Manage Admins"
			emptyMessage="No admins yet."
			addButtonLabel="Add Admin"
			addSearchPlaceholder="Enter username to add as admin"
			removeButtonLabel="Remove Admin"
			showRemoveButton={true}
			canRemove={canRemove}
			listEndpoint={`/api/orgs/${orgId}/admins`}
			addEndpoint={`/api/orgs/${orgId}/admins`}
			removeEndpoint={(memberId) => `/api/orgs/${orgId}/admins/${memberId}`}
		/>
	);
}
