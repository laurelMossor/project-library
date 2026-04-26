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

// ============================================================================
// Identity Routes — handle-keyed (works for User or Page)
// ============================================================================

// Public
export const PUBLIC_PROFILE = (handle: string) => `/${handle}`;
export const PROFILE_ABOUT = (handle: string) => `/${handle}/about`; // PR 3

// Manage (gated by canManageEntity)
export const MANAGE_PROFILE = (handle: string) => `/${handle}/profile`;
export const MANAGE_PROFILE_SETTINGS = (handle: string) => `/${handle}/profile/settings`;
export const MANAGE_PROFILE_EDIT = (handle: string) => `/${handle}/profile#profile-section`;
export const MANAGE_CONNECTIONS = (handle: string) => `/${handle}/connections`;

export const PAGE_NEW = "/pages/new";

export const WELCOME_PAGE = "/welcome";
export const COLLECTIONS = "/collections";
export const EXPLORE_PAGE = "/explore";

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
export const MESSAGE_CONVERSATION = ({ id, type }: { id: string; type: "user" | "page" }) => `/messages/${type === "page" ? "p" : "u"}/${id}`;

// ============================================================================
// API Routes
// ============================================================================
export const API_AUTH_SESSION = "/api/auth/session";
export const API_AUTH_SIGNUP = "/api/auth/signup";

// Current User Context API Routes (all under /api/me/)
export const API_ME_USER = "/api/me/user"; // GET/PUT current user profile
export const API_ME_PAGE = "/api/me/page"; // GET/PUT current active page profile
export const API_ME_PAGES = "/api/me/pages"; // GET user's pages
export const API_SESSION_ACTIVE_PAGE = "/api/session/active-page"; // PUT/DELETE active page (with server validation)

// Event API Routes
export const API_EVENTS = "/api/events";
export const API_EVENT = (id: string) => `/api/events/${id}`;
export const API_EVENT_POSTS = (id: string) => `/api/events/${id}/posts`;
export const API_EVENT_RSVPS = (id: string) => `/api/events/${id}/rsvps`;
export const API_EVENT_RSVP_COUNTS = (id: string) => `/api/events/${id}/rsvps/counts`;

// Post API Routes
export const API_POSTS = "/api/posts";
export const API_POST = (id: string) => `/api/posts/${id}`;

// Page API Routes
export const API_PAGES = "/api/pages";
export const API_PAGE = (pageId: string) => `/api/pages/${pageId}`;
export const API_PAGE_MEMBERSHIP = (pageId: string) => `/api/pages/${pageId}/membership`;

// Follow API Routes
export const API_FOLLOWS = "/api/follows";
export const API_FOLLOW = (targetId: string) => `/api/follows/${targetId}`;

// Message API Routes
export const API_MESSAGES = "/api/messages";
export const API_MESSAGE = (userId: string) => `/api/messages/conversation/${userId}`;
export const API_MESSAGES_UNREAD_COUNT = "/api/messages/unread-count";

// ============================================================================
// Other Pages
// ============================================================================
export const HOME = "/";
export const ABOUT = "/about";
export const DEV_TAXONOMY = "/dev/taxonomy";

export const FEEDBACK_SURVEY = "https://docs.google.com/forms/d/e/1FAIpQLScQeZneNUq6QhpJ_dbIJ2-E7zr186HFer9V5x6kDSb0Bzxl8A/viewform?usp=header"
export const BUG_REPORT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLScfIyo6yd_EvuJw4xJH-FFBgNid73QIGkAWaxUHVnSpgPbE4Q/viewform?usp=dialog";
export const GITHUB_REPO = "https://github.com/laurelMossor/project-library";
export const INSTAGRAM = "https://instagram.com/project.library";
export const ACCOUNT_INTEREST_FORM = "https://forms.gle/t1qhihX7Zi99ikaB9";
