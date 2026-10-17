import { ReactNode } from "react";

/**
 * Small solid circle for something that needs attention.
 * Alone, it sits inline. Wrapped around a target, it pins to that target's top-right,
 * the same way it sits on the notifications bell.
 *
 * Exposes an accessible name (`role="status"` + `aria-label`) so screen
 * readers announce the unread state and tests can target it by role/label
 * instead of its color class.
 */
export function NotificationDot({ label = "Unread", children }: { label?: string; children?: ReactNode }) {
	const dot = (
		<span
			role="status"
			aria-label={label}
			className="inline-block w-2 h-2 rounded-full bg-novel-red shrink-0"
		/>
	);
	if (children == null) return dot;
	return (
		<span className="relative inline-flex">
			{children}
			<span className="pointer-events-none absolute -top-0.5 -right-0.5 flex leading-none">{dot}</span>
		</span>
	);
}
