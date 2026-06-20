/**
 * Small solid circle indicator for unread notifications.
 * Used as an overlay on icons and as an inline row indicator.
 *
 * Exposes an accessible name (`role="status"` + `aria-label`) so screen
 * readers announce the unread state and tests can target it by role/label
 * instead of its color class.
 */
export function NotificationDot({ label = "Unread" }: { label?: string }) {
	return (
		<span
			role="status"
			aria-label={label}
			className="inline-block w-2 h-2 rounded-full bg-novel-red shrink-0"
		/>
	);
}
