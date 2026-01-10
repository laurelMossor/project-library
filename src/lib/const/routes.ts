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
export const PRIVATE_USER_PAGE = "/profile";
export const PROFILE_EDIT = "/profile/edit";
export const PUBLIC_USER_PAGE = (username: string) => `/u/${username}`;
export const USER_COLLECTIONS = (username: string) => `/u/${username}/collections`;

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
export const API_PROFILE = "/api/profile";
export const API_PROJECTS = "/api/projects";
export const API_PROJECT_UPLOAD = "/api/projects/upload";
export const API_PROJECT = (id: string) => `/api/projects/${id}`;
export const API_PROJECT_ENTRIES = (id: string) => `/api/projects/${id}/entries`;
export const API_EVENTS = "/api/events";
export const API_EVENT = (id: string) => `/api/events/${id}`;
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