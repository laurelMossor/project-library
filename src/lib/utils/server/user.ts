// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";

// Standard fields to select when fetching a user profile
const personalProfileFields = {
	id: true,
	actorId: true,
	username: true,
	email: true,
	firstName: true,
	middleName: true,
	lastName: true,
	headline: true,
	bio: true,
	interests: true,
	location: true,
	avatarImageId: true,
} as const;

// Public fields (excludes sensitive data like email, but includes ID for messaging)
export const publicUserFields = {
	id: true,
	actorId: true,
	username: true,
	firstName: true,
	middleName: true,
	lastName: true,
	headline: true,
	bio: true,
	interests: true,
	location: true,
	avatarImageId: true,
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
		firstName?: string;
		middleName?: string;
		lastName?: string;
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
		avatarImageId?: string | null;
	}
) {
	return prisma.user.update({
		where: { id: userId },
		data: {
			firstName: data.firstName,
			middleName: data.middleName,
			lastName: data.lastName,
			headline: data.headline,
			bio: data.bio,
			interests: data.interests || [],
			location: data.location,
			avatarImageId: data.avatarImageId,
		},
		select: personalProfileFields,
	});
}

// Get actor for a user
export async function getActorForUser(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { actorId: true },
	});
	if (!user) return null;
	
	return prisma.actor.findUnique({
		where: { id: user.actorId },
		include: { user: true },
	});
}
