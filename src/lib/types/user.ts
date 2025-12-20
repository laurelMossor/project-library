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
	username: string;
	name?: string;
	headline?: string;
	bio?: string;
	interests?: string[];
	location?: string;
}