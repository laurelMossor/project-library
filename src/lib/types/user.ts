import type { ProfileElementItem } from "./profile-element";
import type { ContentVisibility, ProfileVisibility } from "@prisma/client";

export type { ContentVisibility, ProfileVisibility };

export interface ProfileData {
	firstName?: string;
	middleName?: string;
	lastName?: string;
	displayName?: string;
	headline?: string;
	bio?: string;
	interests?: string[];
	location?: string;
	profileVisibility?: ProfileVisibility;
	contentVisibility?: ContentVisibility;
	avatarImageId?: string | null;
}

export interface User {
	id: string;
	email: string;
	passwordHash: string;
	handle: string;
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
	displayName: string | null;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
	profileVisibility: ProfileVisibility;
	contentVisibility: ContentVisibility;
	avatarImageId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// Public user profile (excludes sensitive data like email and passwordHash)
export interface PublicUser {
	id: string;
	handle: string;
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
	displayName: string | null;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
	profileVisibility: ProfileVisibility;
	contentVisibility: ContentVisibility;
	aboutContent: string | null;
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
	elements: ProfileElementItem[];
}

export function getUserDisplayName(user: { displayName?: string | null; firstName?: string | null; lastName?: string | null; handle: string }): string {
	if (user.displayName) return user.displayName;
	const parts = [user.firstName, user.lastName].filter(Boolean);
	if (parts.length > 0) return parts.join(" ");
	return user.handle;
}
