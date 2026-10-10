import type { MembershipPolicy, PermissionRole } from "@prisma/client";
import type { CardPage, CardUser } from "./card";

/** The viewer's own standing on a page: their role, or whether a join request is pending. */
export type MembershipStatus = { role: PermissionRole | null; requested: boolean };

/** One follow edge, shown from the side of the profile whose Connections screen it is. */
export type ConnectionItem = {
	id: string;
	type: "USER" | "PAGE";
	followedAt: string;
	user: CardUser | null;
	page: CardPage | null;
};

/** A pending FOLLOW or JOIN request waiting on the profile whose Connections screen it is. */
export type RequestItem = {
	id: string;
	kind: "FOLLOW" | "JOIN";
	requester: CardUser | null;
	requesterPage: CardPage | null;
};

/** A page member, or (`pending`) a person invited who hasn't accepted. A pending row's id is the request id. */
export type MemberItem = {
	id: string;
	role: PermissionRole;
	pending: boolean;
	user: CardUser;
};

/** A page's pending invite sent by email: shown by address only, never a profile. */
export type EmailInviteItem = {
	id: string;
	email: string;
	role: PermissionRole;
};

/** A role invitation waiting on the user. */
export type InviteItem = {
	id: string;
	role: PermissionRole | null;
	/** The inviting admin's optional note. */
	note: string | null;
	page: CardPage | null;
};

/** A page the user holds a role on. */
export type PageMembershipItem = {
	id: string;
	role: PermissionRole;
	page: CardPage;
};

/** Everything the Connections screen shows for one identity (user or page), read on the server. */
export type ConnectionsData = {
	followers: ConnectionItem[];
	following: ConnectionItem[];
	/** Page: its members, plus (admin only) pending profile invites. */
	members: MemberItem[];
	/** Page, admin only: pending invites sent by email. */
	emailInvites: EmailInviteItem[];
	/** User: pages they hold a role on. */
	memberOf: PageMembershipItem[];
	/** Page (admin only) or user: requests waiting on this identity. */
	requests: RequestItem[];
	/** User: role invitations waiting on them. */
	invites: InviteItem[];
	/** Page: decides which roles an admin may offer. Null for a user. */
	membershipPolicy: MembershipPolicy | null;
};
