// Route constants for the application
// Use these constants instead of hardcoded paths throughout the app

// ============================================================================
// Authentication Routes
// ============================================================================
export const LOGIN = "/login";
export const SIGNUP = "/signup";
/** Query param name for one-time signup token (`/signup?invite=...`). */
export const SIGNUP_INVITE_QUERY = "invite";
export const SIGNUP_WITH_INVITE = (inviteToken: string) =>
	`${SIGNUP}?${SIGNUP_INVITE_QUERY}=${encodeURIComponent(inviteToken)}`;
export const LOGIN_WITH_CALLBACK = (callbackUrl: string) => `${LOGIN}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

// Email verification
export const VERIFY_EMAIL = "/verify-email";
/** Post-signup "check your inbox" landing. */
export const CHECK_INBOX = "/verify-email/check-inbox";
/** Query param name for the verification token (`/verify-email?token=...`). */
export const VERIFY_EMAIL_TOKEN_QUERY = "token";
export const VERIFY_EMAIL_WITH_TOKEN = (token: string) =>
	`${VERIFY_EMAIL}?${VERIFY_EMAIL_TOKEN_QUERY}=${encodeURIComponent(token)}`;

// Password reset
export const FORGOT_PASSWORD = "/forgot-password";
export const RESET_PASSWORD = "/reset-password";
/** Query param name for the password-reset token (`/reset-password?token=...`). */
export const RESET_PASSWORD_TOKEN_QUERY = "token";
export const RESET_PASSWORD_WITH_TOKEN = (token: string) =>
	`${RESET_PASSWORD}?${RESET_PASSWORD_TOKEN_QUERY}=${encodeURIComponent(token)}`;

// ============================================================================
// Identity Routes
// ============================================================================

// Public — handle-keyed
export const PUBLIC_PROFILE = (handle: string) => `/${handle}`;
export const PROFILE_ABOUT = (handle: string) => `/${handle}/about`; // PR 3

// Session-scoped — active profile resolved from session, no handle in URL
export const SETUP = "/setup";
export const SETTINGS = "/settings";
export const PERSONAL_INFO = "/settings/personal-info";
export const PROFILE_SETTINGS = "/settings/profile";

// Unsubscribe (per-section link in notification emails; stateless token, no login)
export const UNSUBSCRIBE = "/unsubscribe";
export const UNSUBSCRIBE_TOKEN_QUERY = "token";
export const UNSUBSCRIBE_WITH_TOKEN = (token: string) =>
	`${UNSUBSCRIBE}?${UNSUBSCRIBE_TOKEN_QUERY}=${encodeURIComponent(token)}`;
export const CONNECTIONS = "/connections";
export const CONNECTIONS_TAB_QUERY = "tab"; // ?tab= selects the initial connections tab
export const CONNECTIONS_REQUESTS = `${CONNECTIONS}?${CONNECTIONS_TAB_QUERY}=Requests`; // deep-link to the Requests tab
export const CONNECTIONS_MEMBERSHIP = `${CONNECTIONS}?${CONNECTIONS_TAB_QUERY}=Membership`; // deep-link to the Membership tab

export const PAGE_NEW = "/pages/new";

// ============================================================================
// Admin (superadmin-gated operator surfaces)
// ============================================================================
export const ADMIN_SUBMISSIONS = "/admin/submissions";

export const WELCOME_PAGE = "/welcome";
export const COLLECTIONS = "/collections";
export const EXPLORE_PAGE = "/explore";
export const SEARCH = "/search";

// ============================================================================
// Event Routes
// ============================================================================
export const EVENTS = "/events";
export const EVENT_NEW = "/events/new";
export const EVENT_DETAIL = (id: string) => `/events/${id}`;

// ============================================================================
// Post Routes
// ============================================================================
export const POSTS = "/posts";
export const POST_NEW = "/posts/new";
export const POST_DETAIL = (id: string) => `/posts/${id}`;
/** DOM id of one comment row on a post/event detail page. */
export const COMMENT_ANCHOR = (commentId: string) => `comment-${commentId}`;
/** Query param naming the comment a detail page should scroll to and highlight (notification links). */
export const COMMENT_PARAM = "comment";
/** A post/event detail URL that lands on one of its comments. */
export const COMMENT_LINK = (detailUrl: string, commentId: string) =>
	`${detailUrl}?${COMMENT_PARAM}=${encodeURIComponent(commentId)}`;

// ============================================================================
// Message Routes
// ============================================================================
export const MESSAGES = "/messages";
// `asPageId` (optional) makes the link open the conversation under a page identity the viewer
// manages — a one-shot entry consumed and stripped by the conversation page (see its useEffect).
// DM entry by the other party (profile "Message" button) — resolves to the DM's conversation page.
export const MESSAGE_CONVERSATION = ({ id, type, asPageId }: { id: string; type: "user" | "page"; asPageId?: string | null }) =>
	`/messages/${type === "page" ? "p" : "u"}/${id}${asPageId ? `?asPageId=${encodeURIComponent(asPageId)}` : ""}`;
// A conversation (DM or group) by id — the canonical thread URL. Same one-shot `asPageId` as above.
export const MESSAGE_THREAD = (conversationId: string, asPageId?: string | null) =>
	`/messages/c/${conversationId}${asPageId ? `?asPageId=${encodeURIComponent(asPageId)}` : ""}`;

// ============================================================================
// API Routes
// ============================================================================
export const API_AUTH_SESSION = "/api/auth/session";
export const API_AUTH_SIGNUP = "/api/auth/signup";
export const API_HANDLE_AVAILABLE = "/api/handles/available"; // GET ?handle= — public, rate-limited
export const API_AUTH_VERIFY_EMAIL = "/api/auth/verify-email";
export const API_AUTH_RESEND_VERIFICATION = "/api/auth/resend-verification";
export const API_AUTH_FORGOT_PASSWORD = "/api/auth/forgot-password";
export const API_AUTH_RESET_PASSWORD = "/api/auth/reset-password";

// Current User Context API Routes (all under /api/me/)
// Profile, handle, setup, account/page delete, notification prefs, and the active-identity
// switch are Server Actions in src/lib/actions/{profile,account,page,settings,session}.ts.
export const API_ME_USER = "/api/me/user"; // GET current user profile
export const API_ME_USER_DELETE_PREVIEW = "/api/me/user/delete-preview"; // GET pages deleted with the account
export const API_ME_PAGE = "/api/me/page"; // GET current active page profile
export const API_ME_PAGES = "/api/me/pages"; // GET user's pages
export const API_ME_NOTIFICATION_PREFS = "/api/me/notification-preferences"; // GET email prefs for the active identity

// Unsubscribe + the scheduled email flush (pinged by a GitHub Action)
export const API_UNSUBSCRIBE = "/api/unsubscribe";
export const API_NOTIFICATIONS_FLUSH = "/api/notifications/flush";

// Event API Routes
export const API_EVENTS = "/api/events";
export const API_EVENT_POSTS = (id: string) => `/api/events/${id}/posts`;

// Post API Routes
export const API_POSTS = "/api/posts";
export const API_POST_POSTS = (id: string) => `/api/posts/${id}/posts`;

// Image API Routes (attach / caption / remove are Server Actions in src/lib/actions/image.ts)
export const API_UPLOAD = (folder: string) => `/api/upload?folder=${folder}`;

// Poster Catcher review is server-rendered at /admin/submissions with Server Actions in
// src/lib/actions/admin.ts (superadmin-gated).

// Telegram intake webhook (Poster Catcher)
export const API_TELEGRAM_WEBHOOK = "/api/telegram/webhook";

// Page create/delete are Server Actions in src/lib/actions/page.ts.
// Membership, invites, and access requests are Server Actions in src/lib/actions/membership.ts.
// Their lists are read on the server page (connections.ts), not through GET routes.

// Follow API Routes
export const API_FOLLOW = (targetId: string) => `/api/follows/${targetId}`;

// Message API Routes (reads only — sends, DM resolve, and group create/edit/leave are Server
// Actions in src/lib/actions/message.ts)
export const API_SEARCH_PROFILES = (q: string, type: "user" | "page" | "all" = "all") =>
	`/api/search/profiles?q=${encodeURIComponent(q)}&type=${type}`;
export const API_MESSAGES_SUGGESTIONS = (asPageId?: string | null) =>
	asPageId ? `/api/messages/suggestions?asPageId=${encodeURIComponent(asPageId)}` : "/api/messages/suggestions";
/** GET a thread (pass `asPageId` for a page identity). */
export const API_CONVERSATION = (id: string, asPageId?: string | null) =>
	`/api/messages/conversations/${id}${asPageId ? `?asPageId=${encodeURIComponent(asPageId)}` : ""}`;
export const API_MESSAGES_UNREAD_COUNT = "/api/messages/unread-count";

// Activity notifications (mark-read is a Server Action in src/lib/actions/notification.ts)
export const API_NOTIFICATIONS = "/api/notifications"; // GET list (?context=personal|<pageId>)
export const API_NOTIFICATIONS_UNREAD_COUNT = "/api/notifications/unread-count"; // GET { personal, pages }
/** Inbox for the active identity — pass `asPageId` to scope to a managed page, omit for personal. */
export const API_MESSAGES_INBOX = (asPageId?: string | null) =>
	asPageId ? `/api/messages/inbox?asPageId=${encodeURIComponent(asPageId)}` : "/api/messages/inbox";

// ============================================================================
// Other Pages
// ============================================================================
export const HOME = "/";
export const ABOUT = "/about";
export const GUIDELINES = "/guidelines";
export const DEV_TAXONOMY = "/dev/taxonomy";

export const FEEDBACK_SURVEY = "https://docs.google.com/forms/d/e/1FAIpQLScQeZneNUq6QhpJ_dbIJ2-E7zr186HFer9V5x6kDSb0Bzxl8A/viewform?usp=header"
export const BUG_REPORT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLScfIyo6yd_EvuJw4xJH-FFBgNid73QIGkAWaxUHVnSpgPbE4Q/viewform?usp=dialog";
export const GITHUB_REPO = "https://github.com/laurelMossor/project-library";
export const INSTAGRAM = "https://instagram.com/project.library";
export const ACCOUNT_INTEREST_FORM = "https://forms.gle/t1qhihX7Zi99ikaB9";
