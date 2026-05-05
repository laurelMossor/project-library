// ⚠️ SERVER-ONLY: Messaging utility functions
import { prisma } from "./prisma";

export interface ConversationSummary {
  id: string;
  participants: Array<{
    userId?: string | null;
    pageId?: string | null;
    user?: { id: string; handle: string; firstName: string | null; lastName: string | null; avatarImageId: string | null } | null;
    page?: { id: string; name: string; handle: string; avatarImageId: string | null } | null;
  }>;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    asPageId: string | null;
    createdAt: Date;
  } | null;
}

/** Get all conversations for a user (direct participant or via page permissions) */
export async function getConversationsForUser(userId: string): Promise<ConversationSummary[]> {
  // Get conversations where user is a direct participant
  const directConvos = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  // Get conversations where user has permission on a participating page
  const userPermissions = await prisma.permission.findMany({
    where: { userId, resourceType: "PAGE", role: { in: ["ADMIN", "EDITOR"] } },
    select: { resourceId: true },
  });
  const pageIds = userPermissions.map(p => p.resourceId);

  const pageConvos = pageIds.length > 0
    ? await prisma.conversationParticipant.findMany({
        where: { pageId: { in: pageIds } },
        select: { conversationId: true },
      })
    : [];

  const allConvoIds = [...new Set([
    ...directConvos.map(c => c.conversationId),
    ...pageConvos.map(c => c.conversationId),
  ])];

  if (allConvoIds.length === 0) return [];

  const conversations = await prisma.conversation.findMany({
    where: { id: { in: allConvoIds } },
    include: {
      participants: {
        include: {
          user: { select: { id: true, handle: true, firstName: true, lastName: true, avatarImageId: true } },
          page: { select: { id: true, name: true, handle: true, avatarImageId: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, content: true, senderId: true, asPageId: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return conversations.map(c => ({
    id: c.id,
    participants: c.participants,
    lastMessage: c.messages[0] || null,
  }));
}

/** Send a message in a conversation */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  asPageId?: string | null
) {
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      asPageId: asPageId || null,
    },
  });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

/** Create a new DM conversation between a user and another user or page */
export async function createConversation(
  initiatorUserId: string,
  targetUserId?: string,
  targetPageId?: string
) {
  return prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: initiatorUserId },
          ...(targetUserId ? [{ userId: targetUserId }] : []),
          ...(targetPageId ? [{ pageId: targetPageId }] : []),
        ],
      },
    },
    include: {
      participants: true,
    },
  });
}

/** Mark messages as read */
export async function markMessagesRead(conversationId: string, userId: string) {
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}
