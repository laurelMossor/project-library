import type { ActionError } from "@/lib/types/action";

/**
 * Base for caller-fixable errors thrown by server utils. `code` says how a
 * Server Action reports it, and `message` is safe to show the user.
 * Anything that is not a DomainError is treated as a server bug.
 */
export class DomainError extends Error {
	readonly code: ActionError;
	/**
	 * Re-render the current page even though this is a refusal. Set it when the
	 * refusal still changed stored state (an invite withdrawn because the page's
	 * policy no longer allows that role), so the screen drops the stale row.
	 */
	readonly refresh: boolean;

	constructor(message: string, code: ActionError = "invalid", options?: { refresh?: boolean }) {
		super(message);
		this.code = code;
		this.refresh = options?.refresh ?? false;
		this.name = new.target.name;
	}
}
