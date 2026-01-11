import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./utils/server/prisma";
import { LOGIN } from "./const/routes";

export const { handlers, signIn, signOut, auth, update } = NextAuth({
	secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
	providers: [
		Credentials({
			// Fields shown on the default sign-in page (we use custom pages instead)
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			// Validate credentials against the database
			async authorize(credentials) {
				try {
					const email = credentials?.email as string;
					const password = credentials?.password as string;

					if (!email || !password) return null;

					// Normalize email to lowercase for case-insensitive login
					const normalizedEmail = email.toLowerCase().trim();

					const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
					if (!user) return null;

					const passwordMatch = await bcrypt.compare(password, user.passwordHash);
					if (!passwordMatch) return null;

					// Return user object (excluding password) for session
					// Note: name field removed in v2, use firstName/lastName if needed
					return {
						id: user.id,
						email: user.email,
						// name field removed - use firstName/lastName from user profile if needed
					};
				} catch (error) {
					console.error("Authorization error:", error);
					return null;
				}
			},
		}),
	],
	pages: {
		signIn: LOGIN,
	},
	callbacks: {
		// Include user.id and activeOrgId in the session so we can use it in server components
		async session({ session, token }) {
			try {
				if (token?.sub) {
					session.user.id = token.sub;
				}
				// Include activeOrgId from token if present
				if (token?.activeOrgId) {
					session.user.activeOrgId = token.activeOrgId;
				}
				return session;
			} catch (error) {
				console.error("Session callback error:", error);
				return session;
			}
		},
		async jwt({ token, user, trigger, session: sessionData }) {
			// On sign in, set user id
			if (user) {
				token.sub = user.id;
				// Clear activeOrgId on new sign in
				token.activeOrgId = undefined;
			}
			// Allow updating activeOrgId via session update (from API routes)
			if (trigger === "update" && sessionData?.activeOrgId !== undefined) {
				token.activeOrgId = sessionData.activeOrgId;
			}
			return token;
		},
	},
});

