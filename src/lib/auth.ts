import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./utils/server/prisma";
import { LOGIN } from "./const/routes";
import { logAction } from "./utils/server/log";
import { normalizeEmail } from "./validations";
import { canPostAsPage } from "./utils/server/permission";

/**
 * Thrown when credentials are valid but the account's email isn't verified.
 * The `code` surfaces to the client (signIn result) so the login page can show
 * a targeted "verify your email" message + resend affordance. Login is blocked.
 */
export class EmailNotVerifiedError extends CredentialsSignin {
	code = "email_not_verified";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
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
					const normalizedEmail = normalizeEmail(email);

					const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
					if (!user) return null;

					const passwordMatch = await bcrypt.compare(password, user.passwordHash);
					if (!passwordMatch) return null;

					// Block login until the email is verified. Existing users were
					// grandfathered to verified in the adding migration.
					if (!user.emailVerified) {
						throw new EmailNotVerifiedError();
					}

					logAction("user.login", user.id);

					// Return user object (excluding password) for session
					// Note: name field removed in v2, use firstName/lastName if needed
					return {
						id: user.id,
						email: user.email,
						// Stamped into the JWT so the session callback can detect a stale
						// epoch (bumped on password reset) and force re-login.
						tokenVersion: user.tokenVersion,
						// name field removed - use firstName/lastName from user profile if needed
					};
				} catch (error) {
					// Let Auth.js handle credential-signin errors (e.g. unverified
					// email) so their `code` reaches the client; only swallow
					// unexpected failures into a generic null (failed login).
					if (error instanceof CredentialsSignin) throw error;
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
		// Include user.id and activePageId in the session so we can use it in server components
		async session({ session, token }) {
			try {
				if (token?.sub) {
					// Reject sessions whose epoch is stale (e.g. after a password
					// reset) or whose user no longer exists. One indexed lookup per
					// authenticated request; getSessionContext() then trusts the session.
					const user = await prisma.user.findUnique({
						where: { id: token.sub },
						select: { tokenVersion: true },
					});
					if (!user || (token.tokenVersion ?? 0) !== user.tokenVersion) {
						// Leave session.user without an id → treated as unauthenticated.
						return session;
					}
					session.user.id = token.sub;
					// Include activePageId from token if present
					if (token.activePageId) {
						session.user.activePageId = token.activePageId;
					}
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
				token.sub = user.id as string;
				token.tokenVersion = user.tokenVersion ?? 0;
				// Users don't default to a page on sign in
				token.activePageId = undefined;
			}
			// Allow updating activePageId via session update. The client can call
			// useSession().update() directly, so this value is NOT trusted — validate the caller may
			// act as the page before persisting it to the token, at the choke point (finding #9). This
			// branch only runs on an explicit update() (Node runtime), so the DB call is safe here.
			if (trigger === "update" && sessionData?.activePageId !== undefined) {
				const nextActivePageId = sessionData.activePageId as string | null;
				if (!nextActivePageId) {
					token.activePageId = undefined;
				} else if (typeof token.sub === "string" && (await canPostAsPage(token.sub, nextActivePageId))) {
					token.activePageId = nextActivePageId;
				}
				// An unauthorized / unknown page id is ignored — the token keeps its prior identity.
			}
			return token;
		},
	},
});
