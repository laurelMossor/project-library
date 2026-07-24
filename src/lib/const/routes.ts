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
export const SETTINGS = "/settings";
export const PERSONAL_INFO = "/settings/personal-info";
export const NOTIFICATIONS_SETTINGS = "/settings/notifications";

// Unsubscribe (per-section link in notification emails; stateless token, no login)
export const UNSUBSCRIBE = "/unsubscribe";
export const UNSUBSCRIBE_TOKEN_QUERY = "token";
export const UNSUBSCRIBE_WITH_TOKEN = (token: string) =>
	`${UNSUBSCRIBE}?${UNSUBSCRIBE_TOKEN_QUERY}=${encodeURIComponent(token)}`;
export const CONNECTIONS = "/connections";
export const CONNECTIONS_TAB_QUERY = "tab"; // ?tab= selects the initial connections tab
export const CONNECTIONS_REQUESTS = `${CONNECTIONS}?${CONNECTIONS_TAB_QUERY}=Requests`; // deep-link to the Requests tab

export const PAGE_NEW = "/pages/new";

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

// ============================================================================
// Message Routes
// ============================================================================
export const MESSAGES = "/messages";
// `asPageId` (optional) makes the link open the conversation under a page identity the viewer
// manages — a one-shot entry consumed and stripped by the conversation page (see its useEffect).
export const MESSAGE_CONVERSATION = ({ id, type, asPageId }: { id: string; type: "user" | "page"; asPageId?: string | null }) =>
	`/messages/${type === "page" ? "p" : "u"}/${id}${asPageId ? `?asPageId=${encodeURIComponent(asPageId)}` : ""}`;

// ============================================================================
// API Routes
// ============================================================================
export const API_AUTH_SESSION = "/api/auth/session";
export const API_AUTH_SIGNUP = "/api/auth/signup";
export const API_AUTH_VERIFY_EMAIL = "/api/auth/verify-email";
export const API_AUTH_RESEND_VERIFICATION = "/api/auth/resend-verification";
export const API_AUTH_FORGOT_PASSWORD = "/api/auth/forgot-password";
export const API_AUTH_RESET_PASSWORD = "/api/auth/reset-password";

// Current User Context API Routes (all under /api/me/)
export const API_ME_USER = "/api/me/user"; // GET/PUT current user profile
export const API_ME_PAGE = "/api/me/page"; // GET/PUT current active page profile
export const API_ME_PAGES = "/api/me/pages"; // GET user's pages
export const API_ME_NOTIFICATION_PREFS = "/api/me/notification-preferences"; // GET/PUT email prefs for the active identity
export const API_SESSION_ACTIVE_PAGE = "/api/session/active-page"; // PUT/DELETE active page (with server validation)

// Unsubscribe + the scheduled email flush (pinged by a GitHub Action)
export const API_UNSUBSCRIBE = "/api/unsubscribe";
export const API_NOTIFICATIONS_FLUSH = "/api/notifications/flush";

// Event API Routes
export const API_EVENTS = "/api/events";
export const API_EVENT = (id: string) => `/api/events/${id}`;
export const API_EVENT_POSTS = (id: string) => `/api/events/${id}/posts`;
export const API_EVENT_RSVPS = (id: string) => `/api/events/${id}/rsvps`;
export const API_EVENT_RSVP_COUNTS = (id: string) => `/api/events/${id}/rsvps/counts`;
export const API_EVENT_COMMENTS = (id: string) => `/api/events/${id}/comments`;

// Post API Routes
export const API_POSTS = "/api/posts";
export const API_POST = (id: string) => `/api/posts/${id}`;
export const API_POST_COMMENTS = (id: string) => `/api/posts/${id}/comments`;

// Comment API Routes
export const API_COMMENT = (id: string) => `/api/comments/${id}`;

// Image API Routes
export const API_UPLOAD = (folder: string) => `/api/upload?folder=${folder}`;
export const API_IMAGE_ATTACHMENTS = "/api/image-attachments";
export const API_IMAGE_ATTACHMENT = (id: string) => `/api/image-attachments/${id}`;
export const API_IMAGE = (id: string) => `/api/images/${id}`;

// Page API Routes
export const API_PAGES = "/api/pages";
export const API_PAGE = (pageId: string) => `/api/pages/${pageId}`;

export const API_PAGE_MEMBERSHIP = (pageId: string) => `/api/pages/${pageId}/membership`;

// Access-request API Routes (Request-to-Follow / Request-to-Join)
export const API_PAGE_REQUESTS = (pageId: string) => `/api/pages/${pageId}/requests`;
export const API_ME_REQUESTS = "/api/me/requests";
export const API_REQUEST_APPROVE = (id: string) => `/api/requests/${id}/approve`;
export const API_REQUEST_DENY = (id: string) => `/api/requests/${id}/deny`;

// Follow API Routes
export const API_FOLLOWS = "/api/follows";
export const API_FOLLOW = (targetId: string) => `/api/follows/${targetId}`;

// Message API Routes
export const API_MESSAGES = "/api/messages";
export const API_MESSAGE = (userId: string) => `/api/messages/conversation/${userId}`;
export const API_MESSAGES_UNREAD_COUNT = "/api/messages/unread-count";

// Activity notifications
export const API_NOTIFICATIONS = "/api/notifications"; // GET list (?context=personal|<pageId>)
export const API_NOTIFICATIONS_UNREAD_COUNT = "/api/notifications/unread-count"; // GET { personal, pages }
export const API_NOTIFICATIONS_READ = "/api/notifications/read"; // PATCH mark a context's unread read
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
