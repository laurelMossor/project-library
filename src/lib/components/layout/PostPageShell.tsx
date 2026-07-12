import { type ReactNode } from "react";

/**
 * Shared outer column for post/event detail pages. Owns the centered max-width column and
 * the optional breadcrumb, and stacks its children vertically — so a page can compose more
 * than one card (the main content card + the comments card) as siblings.
 *
 * The card surface itself is <ContentCard>, wrapped by the page around each section. The
 * page background comes from the app <body> (bg-grey-white); the shell adds no background.
 */
export function PostPageShell({ children, breadcrumb }: { children: ReactNode; breadcrumb?: ReactNode }) {
	return (
		<main className="flex min-h-screen items-start justify-center py-8 px-4">
			<div className="w-full max-w-3xl">
				{breadcrumb && <div className="mb-3">{breadcrumb}</div>}
				<div className="space-y-6">
					{children}
				</div>
			</div>
		</main>
	);
}
