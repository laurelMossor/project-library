import { ReactNode } from "react";
import { Button } from "../ui/Button";

type FormActionsProps = {
	submitLabel: string;
	onCancel?: () => void;
	cancelLabel?: string;
	loading?: boolean;
	disabled?: boolean;
	secondaryAction?: ReactNode;
};

export function FormActions({
	submitLabel,
	onCancel,
	cancelLabel = "Cancel",
	loading = false,
	disabled = false,
	secondaryAction,
}: FormActionsProps) {
	return (
		<div className="flex gap-4 items-center">
			<Button type="submit" disabled={disabled || loading} loading={loading}>
				{submitLabel}
			</Button>
			{onCancel && (
				<Button type="button" onClick={onCancel} disabled={loading} variant="secondary">
					{cancelLabel}
				</Button>
			)}
			{secondaryAction}
		</div>
	);
}

