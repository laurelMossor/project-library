export interface ProfileData {
	firstName?: string;
	middleName?: string;
	lastName?: string;
	headline?: string;
	bio?: string;
	interests?: string[];
	location?: string;
	avatarImageId?: string | null;
}

export interface User {
	id: string;
	actorId: string;
	email: string;
	passwordHash: string;
	username: string;
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
	avatarImageId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// Public user profile (excludes sensitive data like email and passwordHash)
export interface PublicUser {
	id: string;
	actorId: string;
	username: string;
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
	avatarImageId: string | null;
}

// Helper to get display name from user
export function getUserDisplayName(user: { firstName?: string | null; middleName?: string | null; lastName?: string | null; username: string }): string {
	const nameParts = [user.firstName, user.middleName, user.lastName].filter(Boolean);
	return nameParts.length > 0 ? nameParts.join(' ') : user.username;
}