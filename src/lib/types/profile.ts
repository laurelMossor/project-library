import { PublicUser, getUserDisplayName } from "./user";
import { PublicPage } from "./page";

export type ProfileEntity =
  | { type: "USER"; data: PublicUser }
  | { type: "PAGE"; data: PublicPage };

export function getProfileDisplayName(profile: ProfileEntity): string {
  if (profile.type === "USER") return getUserDisplayName(profile.data);
  return profile.data.name;
}

export function getProfileIdentifier(profile: ProfileEntity): string {
  if (profile.type === "USER") return profile.data.username;
  return profile.data.slug;
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
