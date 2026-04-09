import { type ReactNode } from "react";

/**
 * Shared outer shell for creation/editing pages (events, posts).
 * Provides the centered white card on a slate background.
 * Extract this so both pages can be restyled from one place.
 */
export function DraftPageShell({ children }: { children: ReactNode }) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 py-8 px-4">
			<div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-glow">
				{children}
			</div>
		</main>
	);
}
