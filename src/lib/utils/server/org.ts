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

