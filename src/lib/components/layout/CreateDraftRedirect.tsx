"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useAction } from "@/lib/hooks/useAction";
import { NEW_IN_PARAM } from "@/lib/const/routes";
import { draftPlacement, type DraftPlacement } from "@/lib/utils/draft-placement";
import type { ActionResult } from "@/lib/types/action";

type Props = {
	/**
	 * Creates an empty draft speaking as `asPageId` (or the user) and returns its id.
	 * `pageId` places a draft in the user's own voice on that page.
	 */
	create: (input: DraftPlacement) => Promise<ActionResult<string>>;
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

	// The placement a draft was last created for. React's dev double-invoke (and any re-render
	// that re-runs the effect with the same inputs) must not create a second, orphaned draft.
	const createdFor = useRef<string | null>(null);

	useEffect(() => {
		const key = `${activePageId ?? ""}|${to ?? ""}`;
		if (createdFor.current === key) return;
		createdFor.current = key;
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

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">{children}</main>
	);
}
