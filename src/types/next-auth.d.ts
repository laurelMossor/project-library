// Extend NextAuth types to include activeOrgId in session
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			email: string;
			activeOrgId?: string; // ID of org user is currently "acting as"
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		sub: string; // user id
		activeOrgId?: string; // ID of org user is currently "acting as"
	}
}
