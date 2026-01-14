// ⚠️ SERVER-ONLY: Actor utility functions
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";

/**
 * Get actor for a user
 */
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

/**
 * Get user for an actor
 */
export async function getUserForActor(actorId: string) {
	const actor = await prisma.actor.findUnique({
		where: { id: actorId },
		include: { user: true },
	});
	return actor?.user || null;
}

/**
 * Get actorId for a user (convenience function)
 */
export async function getActorIdForUser(userId: string): Promise<string | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { actorId: true },
	});
	return user?.actorId || null;
}

/**
 * Check if actor owns a project
 */
export async function actorOwnsProject(actorId: string, projectId: string): Promise<boolean> {
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { ownerActorId: true },
	});
	return project?.ownerActorId === actorId;
}

/**
 * Check if actor owns an event
 */
export async function actorOwnsEvent(actorId: string, eventId: string): Promise<boolean> {
	const event = await prisma.event.findUnique({
		where: { id: eventId },
		select: { ownerActorId: true },
	});
	return event?.ownerActorId === actorId;
}

/**
 * Check if actor owns a post
 */
export async function actorOwnsPost(actorId: string, postId: string): Promise<boolean> {
	const post = await prisma.post.findUnique({
		where: { id: postId },
		select: { ownerActorId: true },
	});
	return post?.ownerActorId === actorId;
}

