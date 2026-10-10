import { useCallback, useRef } from "react";
import { handleFromName, nameFromHandle } from "@/lib/utils/handle";

/**
 * Name and handle fill each other once. Typing a name suggests a handle until the
 * handle has been typed by hand, and typing a handle suggests a name until the name
 * has been typed by hand. Call the `on...Typed` handlers only for real keystrokes,
 * never when a suggestion fills a field, or the suggestion would count as hand-typed.
 */
export function useNameHandlePrefill({
	setName,
	setHandle,
}: {
	setName: (name: string) => void;
	setHandle: (handle: string) => void;
}) {
	const nameTyped = useRef(false);
	const handleTyped = useRef(false);

	const onNameTyped = useCallback((next: string) => {
		nameTyped.current = true;
		if (!handleTyped.current) setHandle(handleFromName(next));
	}, [setHandle]);

	const onHandleTyped = useCallback((next: string) => {
		handleTyped.current = true;
		if (nameTyped.current) return;
		// An illegal handle keeps the last good suggestion.
		const suggested = nameFromHandle(next);
		if (suggested) setName(suggested);
	}, [setName]);

	const reset = useCallback(() => {
		nameTyped.current = false;
		handleTyped.current = false;
	}, []);

	return { onNameTyped, onHandleTyped, reset };
}
