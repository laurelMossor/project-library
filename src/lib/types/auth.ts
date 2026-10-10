/** What the signup form sends. A caller that omits `handle` (dev/E2E accounts) gets one generated. */
export type SignupInput = {
	email: string;
	password: string;
	invite: string;
	handle?: string;
	displayName?: string;
};
