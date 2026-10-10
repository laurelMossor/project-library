"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useAction } from "@/lib/hooks/useAction";
import type { ActionResult } from "@/lib/types/action";

type Props = {
	/** Creates an empty draft speaking as `asPageId` (or the user) and returns its id. */
	create: (input: { asPageId: string | null }) => Promise<ActionResult<string>>;
	/** Where the new draft is edited inline. */
	detailHref: (id: string) => string;
	noun: "post" | "event";
};

/**
 * The /posts/new and /events/new entry point: create a draft as the active profile, then
 * replace this page with the draft's own page — the detail page IS the creation surface.
 */
export function CreateDraftRedirect({ create, detailHref, noun }: Props) {
	const router = useRouter();
	const { activePageId } = useActiveProfile();
	const { run, error } = useAction(create);

	useEffect(() => {
		run({ asPageId: activePageId ?? null }).then((result) => {
			if (result.ok) router.replace(detailHref(result.data));
		});
		// Re-create only when the acting identity changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activePageId]);

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
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
		</main>
	);
}
