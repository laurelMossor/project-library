import { prisma } from "./prisma";

// Standard fields to select when fetching a user profile
const personalProfileFields = {
	id: true,
	username: true,
	email: true,
	name: true,
	headline: true,
	bio: true,
	interests: true,
	location: true,
} as const;

// Public fields (excludes sensitive data like email, but includes ID for messaging)
export const publicUserFields = {
	id: true,
	username: true,
	name: true,
	headline: true,
	bio: true,
	interests: true,
	location: true,
} as const;

// Fetch a user by ID (for authenticated user's own profile)
export async function getUserById(id: string) {
	return prisma.user.findUnique({
		where: { id },
		select: personalProfileFields,
	});
}

// Fetch a user by username (for public profile pages)
export async function getUserByUsername(username: string) {
	return prisma.user.findUnique({
		where: { username },
		select: publicUserFields,
	});
}

// Update a user's profile data
export async function updateUserProfile(
	userId: string,
	data: {
		name?: string;
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
	}
) {
	return prisma.user.update({
		where: { id: userId },
		data: {
			name: data.name,
			headline: data.headline,
			bio: data.bio,
			interests: data.interests || [],
			location: data.location,
		},
		select: personalProfileFields,
	});
}
