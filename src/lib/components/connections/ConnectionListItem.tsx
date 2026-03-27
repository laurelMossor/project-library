"use client";

import { Button } from "@/lib/components/ui/Button";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { CardUser } from "@/lib/types/card";

// Re-export CardUser as ConnectionUser for backward compatibility
export type ConnectionUser = CardUser;

type ConnectionListItemProps = {
	user: CardUser;
	role?: string;
	onRemove?: () => void;
	removing?: boolean;
	showRemoveButton?: boolean;
	removeButtonLabel?: string;
};

export function ConnectionListItem({
	user,
	role,
	onRemove,
	removing = false,
	showRemoveButton = true,
	removeButtonLabel = "Remove",
}: ConnectionListItemProps) {
	const removeAction = showRemoveButton && onRemove ? (
		<Button
			onClick={onRemove}
			disabled={removing}
			loading={removing}
			variant="danger"
			size="sm"
		>
			{removeButtonLabel}
		</Button>
	) : null;

	return (
		<ProfileTag
			user={user}
			badge={role}
			actions={removeAction ?? undefined}
		/>
	);
}
