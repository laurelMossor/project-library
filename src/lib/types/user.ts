export interface ProfileData {
	firstName?: string;
	middleName?: string;
	lastName?: string;
	displayName?: string;
	headline?: string;
	bio?: string;
	interests?: string[];
	location?: string;
	isPublic?: boolean;
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
	isPublic: boolean;
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
	aboutContent: string | null;
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
	elements: import("./profile-element").ProfileElementItem[];
}

export function getUserDisplayName(user: { displayName?: string | null; handle: string }): string {
	return user.displayName || user.handle;
}
