// Extend NextAuth types to include activeOwnerId in session
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			email: string;
			activeOwnerId?: string; // ID of Owner user is currently "acting as"
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		sub: string; // user id
		activeOwnerId?: string; // ID of Owner user is currently "acting as"
	}
}
