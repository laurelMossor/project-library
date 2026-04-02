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
	// All admins can be removed; the server enforces that the last admin cannot be removed
	const canRemove = (_item: ConnectionItem) => true;

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
