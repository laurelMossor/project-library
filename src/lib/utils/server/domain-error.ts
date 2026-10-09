import type { ActionError } from "@/lib/types/action";

/**
 * Base for caller-fixable errors thrown by server utils. `code` says how a
 * Server Action reports it, and `message` is safe to show the user.
 * Anything that is not a DomainError is treated as a server bug.
 */
export class DomainError extends Error {
	readonly code: ActionError;

	constructor(message: string, code: ActionError = "invalid") {
		super(message);
		this.code = code;
		this.name = new.target.name;
	}
}
