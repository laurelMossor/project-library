// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";

// Standard fields to select when fetching a user profile
const personalProfileFields = {
	id: true,
	ownerId: true,
	username: true,
	email: true,
	firstName: true,
	middleName: true,
	lastName: true,
	displayName: true,
	headline: true,
	bio: true,
	interests: true,
	location: true,
	isPublic: true,
	avatarImageId: true,
} as const;

// Public fields (excludes sensitive data like email, but includes ID for messaging)
export const publicUserFields = {
	id: true,
	ownerId: true,
	username: true,
	firstName: true,
	middleName: true,
	lastName: true,
	displayName: true,
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
		displayName?: string;
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
		isPublic?: boolean;
		avatarImageId?: string | null;
	}
) {
	// Build update data object with only explicitly provided fields
	// This prevents accidentally overwriting fields with undefined
	const updateData: {
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
	} = {};

	if (data.firstName !== undefined) updateData.firstName = data.firstName;
	if (data.middleName !== undefined) updateData.middleName = data.middleName;
	if (data.lastName !== undefined) updateData.lastName = data.lastName;
	if (data.displayName !== undefined) updateData.displayName = data.displayName;
	if (data.headline !== undefined) updateData.headline = data.headline;
	if (data.bio !== undefined) updateData.bio = data.bio;
	if (data.interests !== undefined) updateData.interests = data.interests;
	if (data.location !== undefined) updateData.location = data.location;
	if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
	if (data.avatarImageId !== undefined) updateData.avatarImageId = data.avatarImageId;

	return prisma.user.update({
		where: { id: userId },
		data: updateData,
		select: personalProfileFields,
	});
}

// Get owner for a user (personal owner)
export async function getOwnerForUser(userId: string) {
	return prisma.owner.findFirst({
		where: { userId, orgId: null },
		include: { user: true },
	});
}
