export interface ProfileData {
	name?: string;
	headline?: string;
	bio?: string;
	interests?: string[];
	location?: string;
}

export interface User {
	id: string;
	email: string;
	passwordHash: string;
	username: string;
	name: string | null;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// Public user profile (excludes sensitive data like email and passwordHash)
export interface PublicUser {
	id: string;
	username: string;
	name: string | null;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
}