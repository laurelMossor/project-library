import type { ReactNode } from "react";

type EventPageShellProps = {
	/** Banner and/or cover image — rendered above the padded content area. */
	header?: ReactNode;
	children: ReactNode;
};

/** Shared outer wrapper used by both EventPageClient and CreateEventPage. */
export function EventPageShell({ header, children }: EventPageShellProps) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 py-8 px-4">
			<div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-glow">
				{header}
				<div className="px-8 py-8 space-y-8">
					{children}
				</div>
			</div>
		</main>
	);
}

/** Shared draft banner. Static on CreateEventPage; conditional on EventPageClient. */
export function DraftBanner() {
	return (
		<div className="bg-alice-blue px-6 py-3 text-center text-sm font-medium text-whale-blue">
			Draft — only you can see this
		</div>
	);
}
