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
	avatarImageId: string | null;
}

// Helper to get display name from org
export function getOrgDisplayName(org: { name: string }): string {
	return org.name;
}

