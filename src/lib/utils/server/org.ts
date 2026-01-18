// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";

// Public fields for org profile
export const publicOrgFields = {
	id: true,
	actorId: true,
	name: true,
	slug: true,
	headline: true,
	bio: true,
	interests: true,
	location: true,
	addressLine1: true,
	addressLine2: true,
	city: true,
	state: true,
	zip: true,
	parentTopic: true,
	isPublic: true,
	avatarImageId: true,
} as const;

// Fetch an org by slug (for public profile pages)
export async function getOrgBySlug(slug: string) {
	return prisma.org.findUnique({
		where: { slug },
		select: publicOrgFields,
	});
}

// Fetch an org by ID
export async function getOrgById(id: string) {
	return prisma.org.findUnique({
		where: { id },
		select: publicOrgFields,
	});
}

// Get all orgs that a user is a member of
export async function getOrgsForUser(userId: string) {
	const orgMemberships = await prisma.orgMember.findMany({
		where: { userId },
		include: {
			org: {
				select: publicOrgFields,
			},
		},
	});
	return orgMemberships.map((membership) => membership.org);
}

// Get org member role for a user
export async function getUserOrgRole(userId: string, orgId: string) {
	const membership = await prisma.orgMember.findUnique({
		where: {
			orgId_userId: {
				orgId,
				userId,
			},
		},
		select: { role: true },
	});
	return membership?.role || null;
}

// Update an org's profile data
export async function updateOrgProfile(
	orgId: string,
	data: {
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		zip?: string | null;
		parentTopic?: string | null;
		isPublic?: boolean;
		avatarImageId?: string | null;
	}
) {
	// Build update data object with only explicitly provided fields
	// This prevents accidentally overwriting fields with undefined
	const updateData: {
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		zip?: string | null;
		parentTopic?: string | null;
		isPublic?: boolean;
		avatarImageId?: string | null;
	} = {};

	if (data.headline !== undefined) updateData.headline = data.headline;
	if (data.bio !== undefined) updateData.bio = data.bio;
	if (data.interests !== undefined) updateData.interests = data.interests;
	if (data.location !== undefined) updateData.location = data.location;
	if (data.addressLine1 !== undefined) updateData.addressLine1 = data.addressLine1;
	if (data.addressLine2 !== undefined) updateData.addressLine2 = data.addressLine2;
	if (data.city !== undefined) updateData.city = data.city;
	if (data.state !== undefined) updateData.state = data.state;
	if (data.zip !== undefined) updateData.zip = data.zip;
	if (data.parentTopic !== undefined) updateData.parentTopic = data.parentTopic;
	if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
	if (data.avatarImageId !== undefined) updateData.avatarImageId = data.avatarImageId;

	return prisma.org.update({
		where: { id: orgId },
		data: updateData,
		select: publicOrgFields,
	});
}

// Create a new org
export async function createOrg(
	userId: string,
	data: {
		name: string;
		slug: string;
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
	}
) {
	const { ActorType, OrgRole } = await import("@prisma/client");

	// Check if slug is already taken
	const existingOrg = await prisma.org.findUnique({
		where: { slug: data.slug },
	});
	if (existingOrg) {
		throw new Error("An organization with this slug already exists");
	}

	// Create actor first (required for Org)
	const actor = await prisma.actor.create({
		data: { type: ActorType.ORG },
	});

	// Create org
	const org = await prisma.org.create({
		data: {
			actorId: actor.id,
			name: data.name.trim(),
			slug: data.slug.trim(),
			headline: data.headline?.trim() || null,
			bio: data.bio?.trim() || null,
			interests: data.interests || [],
			location: data.location?.trim() || null,
		},
		select: publicOrgFields,
	});

	// Create org membership with OWNER role
	await prisma.orgMember.create({
		data: {
			orgId: org.id,
			userId,
			role: OrgRole.OWNER,
		},
	});

	return org;
}
