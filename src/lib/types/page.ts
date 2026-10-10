import type { ProfileElementItem } from "./profile-element";
import type { ContentVisibility, MembershipPolicy, ProfileVisibility } from "@prisma/client";

export interface PublicPage {
  id: string;
  createdByUserId: string;
  name: string;
  handle: string;
  headline: string | null;
  bio: string | null;
  interests: string[];
  location: string | null;
  profileVisibility: ProfileVisibility;
  contentVisibility: ContentVisibility;
  membershipPolicy: MembershipPolicy;
  allowMemberPosts: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  category: string | null;
  tags: string[];
  aboutContent: string | null;
  avatarImageId: string | null;
  avatarImage?: { url: string } | null;
  elements: ProfileElementItem[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What the create-page form sends. `name` and `handle` are required; the rest (about fields,
 * visibility, membership, address, avatar) are checked server-side against the same whitelist
 * that editing an existing page uses.
 */
export type PageCreateInput = {
  /** Chosen up front so the avatar previewed in the form is the one the page keeps. */
  id?: string;
  name: string;
  handle: string;
  [field: string]: unknown;
};

export function getPageDisplayName(page: { name: string }): string {
  return page.name;
}
