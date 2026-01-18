// Public org profile (excludes sensitive data)
export interface PublicOrg {
	id: string;
	actorId: string;
	name: string;
	slug: string;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
	addressLine1: string | null;
	addressLine2: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	parentTopic: string | null;
	isPublic: boolean;
	avatarImageId: string | null;
}

// Helper to get display name from org
export function getOrgDisplayName(org: { name: string }): string {
	return org.name;
}

