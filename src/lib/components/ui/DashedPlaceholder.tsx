import { type ReactNode } from "react";

/**
 * The "space for something" affordance — a soft melon-green box with a dashed ash-green
 * border, used wherever the UI invites the user to add content that isn't there yet
 * (an empty post/event body, an empty comments list). Purely presentational; pass padding,
 * min-height, text color, and alignment via `className` per use.
 */
export function DashedPlaceholder({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<div className={`rounded-lg border border-dashed border-ash-green/60 bg-melon-green/10 ${className}`}>
			{children}
		</div>
	);
}
