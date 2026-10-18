"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useAction } from "@/lib/hooks/useAction";
import { NEW_IN_OWN_PROFILE, NEW_IN_PARAM } from "@/lib/const/routes";
import type { ActionResult } from "@/lib/types/action";

type Props = {
	/**
	 * Creates an empty draft speaking as `asPageId` (or the user) and returns its id.
	 * `pageId` places a draft in the user's own voice on that page.
	 */
	create: (input: { asPageId: string | null; pageId: string | null }) => Promise<ActionResult<string>>;
	/** Where the new draft is edited inline. */
	detailHref: (id: string) => string;
	noun: "post" | "event";
};

/**
 * The /posts/new and /events/new entry point: create a draft as the active profile, then
 * replace this page with the draft's own page — the detail page IS the creation surface.
 */
export function CreateDraftRedirect(props: Props) {
	return (
		<Suspense fallback={<Shell>{null}</Shell>}>
			<CreateDraft {...props} />
		</Suspense>
	);
}

function CreateDraft({ create, detailHref, noun }: Props) {
	const router = useRouter();
	const to = useSearchParams().get(NEW_IN_PARAM);
	const { activePageId } = useActiveProfile();
	const { run, error } = useAction(create);

	useEffect(() => {
		run(draftPlacement(to, activePageId ?? null)).then((result) => {
			if (result.ok) router.replace(detailHref(result.data));
		});
		// Re-create only when the acting identity or target collection changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activePageId, to]);

	return (
		<Shell>
			{error ? (
				<div className="text-center space-y-4">
					<p className="text-alert-red">{error}</p>
					<button
						type="button"
						onClick={() => router.back()}
						className="text-sm font-medium text-gray-500 underline underline-offset-2"
					>
						Go back
					</button>
				</div>
			) : (
				<p className="text-gray-500">Creating your {noun}...</p>
			)}
		</Shell>
	);
}

/**
 * Who speaks and where the draft lives. With no target, the active profile decides.
 * From your own profile: you, personal. From a page's collection: as that page if you're
 * acting as it, otherwise to it in your own voice — acting as some other page doesn't carry over.
 */
function draftPlacement(to: string | null, activePageId: string | null) {
	if (!to) return { asPageId: activePageId, pageId: null };
	if (to === NEW_IN_OWN_PROFILE) return { asPageId: null, pageId: null };
	return { asPageId: activePageId === to ? to : null, pageId: to };
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">{children}</main>
	);
}
