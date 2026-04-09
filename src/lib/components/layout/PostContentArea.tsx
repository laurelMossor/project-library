import { type ReactNode } from "react";

/**
 * Shared inner content area for creation/editing pages (events, posts).
 * Provides consistent padding and vertical spacing between sections.
 * Extract this so both pages can be restyled from one place.
 */
export function PostContentArea({ children }: { children: ReactNode }) {
	return (
		<div className="px-8 py-8 space-y-8">
			{children}
		</div>
	);
}
