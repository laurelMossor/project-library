import { PublicUser, getUserDisplayName } from "./user";
import { PublicPage } from "./page";

/** Follower / following counts for a profile, computed server-side. */
export type FollowCounts = { followers: number; following: number };

/** The lists behind a profile's counts. */
export type ProfileList = "followers" | "following" | "members";

/**
 * Everything the stats row under a profile needs, computed on the server: the counts, a page's
 * member count, and whether this viewer may open the member list (members only; counts are public).
 */
export type ProfileStatsData = {
  target: { type: "user" | "page"; id: string };
  counts: FollowCounts;
  /** Pages only. 0 / absent hides the Members count. */
  memberCount?: number;
  canViewMembers?: boolean;
};

export type ProfileEntity =
  | { type: "USER"; data: PublicUser }
  | { type: "PAGE"; data: PublicPage };

export function getProfileDisplayName(profile: ProfileEntity): string {
  if (profile.type === "USER") return getUserDisplayName(profile.data);
  return profile.data.name;
}

export function getProfileIdentifier(profile: ProfileEntity): string {
  return profile.data.handle;
}

export function getProfileHeadline(profile: ProfileEntity): string | null {
  return profile.data.headline;
}

export function getProfileBio(profile: ProfileEntity): string | null {
  return profile.data.bio;
}

export function getProfileInterests(profile: ProfileEntity): string[] {
  return profile.data.interests || [];
}

export function getProfileLocation(profile: ProfileEntity): string | null {
  return profile.data.location;
}

export function getProfileAvatarImageId(profile: ProfileEntity): string | null {
  return profile.data.avatarImageId;
}

export function getProfileEntityId(profile: ProfileEntity): string {
  return profile.data.id;
}

/**
 * Whose profile a save or handle change is for. A user can only ever edit their own,
 * so `user` carries no id. A page carries its id, and the server checks the caller may act as it.
 */
export type ProfileTarget = { type: "user" } | { type: "page"; id: string };
