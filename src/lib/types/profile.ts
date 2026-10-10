import { PublicUser, getUserDisplayName } from "./user";
import { PublicPage } from "./page";

/** Follower / following counts for a profile, computed server-side. */
export type FollowCounts = { followers: number; following: number };

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
