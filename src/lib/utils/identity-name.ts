/**
 * A blank or missing page name saves as the handle. Page names are required.
 * This is the unnamed-page save, not the live once-only mirror.
 */
export function nameOrHandle(name: string | null | undefined, handle: string): string {
	const trimmed = (name ?? "").trim();
	return trimmed || handle;
}

/**
 * Display name is optional. null means the name is still following the handle.
 * A typed string is kept, including "".
 */
export function followedName(typed: string | null, handle: string): string {
	return typed === null ? handle : typed;
}
