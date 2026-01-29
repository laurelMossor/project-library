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
	ownerId: string | null; // Personal owner id (null until created) TODO: find a way to set the ownerId on user creation
	email: string;
	passwordHash: string;
	username: string;
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
	ownerId: string | null;
	username: string;
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
	displayName: string | null;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
	avatarImageId: string | null;
}

// Helper to get display name from user
// Priority: displayName > firstName + lastName > username
export function getUserDisplayName(user: { displayName?: string | null; firstName?: string | null; middleName?: string | null; lastName?: string | null; username: string }): string {
	// First priority: use displayName if set
	if (user.displayName) {
		return user.displayName;
	}
	
	// Second priority: firstName + lastName (excludes middleName)
	const nameParts = [user.firstName, user.lastName].filter(Boolean);
	if (nameParts.length > 0) {
		return nameParts.join(' ');
	}
	
	// Fallback: username
	return user.username;
}