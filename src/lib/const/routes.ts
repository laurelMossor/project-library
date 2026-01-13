// Route constants for the application
// Use these constants instead of hardcoded paths throughout the app

// ============================================================================
// Authentication Routes
// ============================================================================
export const LOGIN = "/login";
export const SIGNUP = "/signup";
export const LOGIN_WITH_CALLBACK = (callbackUrl: string) => `${LOGIN}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

// ============================================================================
// User & Profile Routes
// ============================================================================
export const PRIVATE_USER_PAGE = "/u/profile";
export const USER_PROFILE_SETTINGS = "/u/profile/settings";
export const USER_PROFILE_EDIT = "/u/profile/edit";
export const PUBLIC_USER_PAGE = (username: string) => `/u/${username}`;
// USER_COLLECTIONS removed - collections are shown inline on public profile

// ============================================================================
// Org & Profile Routes
// ============================================================================
export const PUBLIC_ORG_PAGE = (slug: string) => `/o/${slug}`;
export const PRIVATE_ORG_PAGE = "/o/profile";
export const ORG_PROFILE_SETTINGS = "/o/profile/settings";
export const ORG_PROFILE_EDIT = "/o/profile/edit";
export const ORG_NEW = "/orgs/new";
// ORG_COLLECTIONS removed - collections are shown inline on public profile

// ============================================================================
// Collections Routes
// ============================================================================
export const COLLECTIONS = "/collections";

// ============================================================================
// Project Routes
// ============================================================================
export const PROJECTS = "/projects";
export const PROJECT_NEW = "/projects/new";
export const PROJECT_DETAIL = (id: string) => `/projects/${id}`;
export const PROJECT_EDIT = (id: string) => `/projects/${id}/edit`;
export const PROJECT_ENTRIES = (id: string) => `/projects/${id}/entries`; // Deprecated - use PROJECT_POSTS
export const PROJECT_ENTRY_NEW = (id: string) => `/projects/${id}/entries/new`; // Deprecated - use PROJECT_POST_NEW
export const PROJECT_POSTS = (id: string) => `/projects/${id}/posts`;
export const PROJECT_POST_NEW = (id: string) => `/projects/${id}/posts/new`;

// ============================================================================
// Event Routes
// ============================================================================
export const EVENTS = "/events";
export const EVENT_NEW = "/events/new";
export const EVENT_DETAIL = (id: string) => `/events/${id}`;
export const EVENT_EDIT = (id: string) => `/events/${id}/edit`;

// ============================================================================
// Message Routes
// ============================================================================
export const MESSAGES = "/messages";
export const MESSAGE_CONVERSATION = (userId: string) => `/messages/${userId}`;

// ============================================================================
// API Routes
// ============================================================================
export const API_AUTH_SESSION = "/api/auth/session";
export const API_AUTH_SIGNUP = "/api/auth/signup";

// Current User Context API Routes (all under /api/me/)
export const API_ME_USER = "/api/me/user"; // GET/PUT current user profile
export const API_ME_ORG = "/api/me/org"; // GET/PUT current active org profile
export const API_ME_ORGS = "/api/me/orgs"; // GET user's orgs
export const API_ME_ACTOR = "/api/me/actor"; // GET current actor, PUT to switch actor

// Public User API Routes
export const API_USER_PROJECTS = (username: string) => `/api/users/${username}/projects`;
export const API_USER_EVENTS = (username: string) => `/api/users/${username}/events`;

// Legacy API Routes (deprecated - use new routes above)
export const API_PROFILE = "/api/profile"; // Deprecated - use API_ME_USER

// Project API Routes
export const API_PROJECTS = "/api/projects";
export const API_PROJECT_UPLOAD = "/api/projects/upload";
export const API_PROJECT = (id: string) => `/api/projects/${id}`;
export const API_PROJECT_ENTRIES = (id: string) => `/api/projects/${id}/entries`;
export const API_PROJECT_POSTS = (id: string) => `/api/projects/${id}/posts`;

// Event API Routes
export const API_EVENTS = "/api/events";
export const API_EVENT = (id: string) => `/api/events/${id}`;
export const API_EVENT_POSTS = (id: string) => `/api/events/${id}/posts`;

// Org API Routes
export const API_ORGS = "/api/orgs";

// Message API Routes
export const API_MESSAGES = "/api/messages";
export const API_MESSAGE = (userId: string) => `/api/messages/${userId}`;

// ============================================================================
// Other Pages
// ============================================================================
export const HOME = "/";
export const ABOUT = "/about";
export const DEV_TAXONOMY = "/dev/taxonomy";

export const FEEDBACK_SURVEY = "https://docs.google.com/forms/d/e/1FAIpQLScQeZneNUq6QhpJ_dbIJ2-E7zr186HFer9V5x6kDSb0Bzxl8A/viewform?usp=header"
export const BUG_REPORT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLScfIyo6yd_EvuJw4xJH-FFBgNid73QIGkAWaxUHVnSpgPbE4Q/viewform?usp=dialog";
export const GITHUB_REPO = "https://github.com/project-library/project-library";
export const INSTAGRAM = "https://instagram.com/laurelmossor";