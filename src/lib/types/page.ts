export interface PublicPage {
  id: string;
  createdByUserId: string;
  name: string;
  handle: string;
  headline: string | null;
  bio: string | null;
  interests: string[];
  location: string | null;
  visibility: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  parentTopic: string | null;
  tags: string[];
  isOpenToCollaborators: boolean;
  avatarImageId: string | null;
  avatarImage?: { url: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export function getPageDisplayName(page: { name: string }): string {
  return page.name;
}
