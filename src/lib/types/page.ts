import type { ProfileElementItem } from "./profile-element";

export type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

export interface PublicPage {
  id: string;
  createdByUserId: string;
  name: string;
  handle: string;
  headline: string | null;
  bio: string | null;
  interests: string[];
  location: string | null;
  visibility: Visibility;
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

export function getPageDisplayName(page: { name: string }): string {
  return page.name;
}
