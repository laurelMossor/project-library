import { type ReactNode } from "react";

/**
 * The standard white content card — a rounded, softly-elevated surface on the grey-white
 * page. Extracted from PostPageShell so detail pages can stack more than one card in the
 * same column (e.g. the main post/event card + the comments card).
 *
 * `overflow-hidden` keeps flush children (cover images) clipped to the rounded corners.
 */
export function ContentCard({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<div className={`overflow-hidden rounded-2xl bg-white shadow-glow ${className}`}>
			{children}
		</div>
	);
}
