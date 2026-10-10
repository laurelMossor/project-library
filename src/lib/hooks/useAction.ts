"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOGIN_WITH_CALLBACK } from "@/lib/const/routes";
import type { ActionResult } from "@/lib/types/action";

/**
 * The one way a component calls a Server Action. Runs it in a transition (so the
 * refreshed server props and local state land together), tracks `pending`, keeps
 * the last failure message in `error`, and sends a signed-out caller to login
 * with a callback to the current page.
 */
export function useAction<I, O>(action: (input: I) => Promise<ActionResult<O>>) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const run = useCallback(
		(input: I) =>
			new Promise<ActionResult<O>>((resolve) => {
				startTransition(async () => {
					const result = await action(input);
					if (result.ok) {
						setError(null);
					} else if (result.error === "unauthorized") {
						router.push(LOGIN_WITH_CALLBACK(window.location.pathname + window.location.search));
					} else {
						setError(result.message ?? "Something went wrong. Please try again.");
					}
					resolve(result);
				});
			}),
		[action, router],
	);

	const clearError = useCallback(() => setError(null), []);

	return { run, pending, error, clearError };
}

/** A ready-to-call save: one action with its input bound, or a short sequence of actions. */
export type ActionThunk = () => Promise<ActionResult<unknown>>;

const invokeThunk = (perform: ActionThunk) => perform();

/**
 * `useAction` for a control whose save isn't one fixed action: a row whose buttons each hand over a
 * different bound action, or a button that runs several actions in order. `run(thunk)` gets the same
 * transition, `pending`, `error`, and login redirect; the thunk returns the result that decides them.
 */
export function useActionThunk() {
	return useAction(invokeThunk);
}
