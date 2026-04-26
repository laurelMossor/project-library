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
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
}

// Helper to get display name from user
// Priority: displayName > firstName + lastName > handle
export function getUserDisplayName(user: { displayName?: string | null; firstName?: string | null; middleName?: string | null; lastName?: string | null; handle: string }): string {
	if (user.displayName) {
		return user.displayName;
	}

	const nameParts = [user.firstName, user.lastName].filter(Boolean);
	if (nameParts.length > 0) {
		return nameParts.join(' ');
	}

	return user.handle;
}
