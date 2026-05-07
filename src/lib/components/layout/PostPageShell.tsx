import { type ReactNode } from "react";

/**
 * Shared outer shell for creation/editing pages (events, posts).
 * Provides the centered white card on a slate background.
 * Extract this so both pages can be restyled from one place.
 */
export function PostPageShell({ children, breadcrumb }: { children: ReactNode; breadcrumb?: ReactNode }) {
	return (
		<main className="flex min-h-screen items-start justify-center bg-slate-50 py-8 px-4">
			<div className="w-full max-w-3xl">
				{breadcrumb && <div className="mb-3">{breadcrumb}</div>}
				<div className="overflow-hidden rounded-2xl bg-white shadow-glow">
					{children}
				</div>
			</div>
		</main>
	);
}
