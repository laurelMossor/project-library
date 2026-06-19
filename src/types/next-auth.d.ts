// Extend NextAuth types to include activePageId in session
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
	// `authorize()` returns this; tokenVersion is stamped into the JWT.
	interface User {
		tokenVersion?: number;
	}
	interface Session {
		user: {
			id: string;
			email: string;
			activePageId?: string; // ID of Page user is currently working on
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		sub: string; // user id
		activePageId?: string; // ID of Page user is currently working on
		tokenVersion?: number; // session epoch; mismatch vs DB → forced re-login
	}
}
