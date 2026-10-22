// Display helpers shared by the inbox and the thread: how a conversation, member, or author is named
// and pictured. Pure — no fetching. Identity keys come from `identityKey` in @/lib/const/messaging.
import { resolveCardIdentity, type CardEntity } from "@/lib/types/card";
import { participantAddedText } from "@/lib/utils/participant-added-text";
import type {
	ConversationMember,
	ConversationSummary,
	ConversationThreadData,
	MessageAuthor,
	MessageSubject,
	MessageUser,
} from "@/lib/types/message";

type Named = MessageAuthor | ConversationMember | { type: "user"; user: MessageUser | null };

/** Entity for ProfilePicture, or null when the user/page no longer exists. */
export function memberEntity(x: Named): CardEntity | null {
	return x.type === "page" ? x.page : x.user;
}

/** Full display name ("Sam Example", "Portland Makers Guild"). */
export function fullName(x: Named): string {
	const entity = memberEntity(x);
	if (entity) return resolveCardIdentity(entity).name;
	return x.type === "page" ? "A page" : "Someone";
}

/** Short name for dense group copy ("Sam"); pages keep their full name. */
export function shortName(x: Named): string {
	if (x.type === "page" || !x.user?.firstName) return fullName(x);
	return x.user.firstName;
}

export const otherMembers = (c: { members: ConversationMember[] }) => c.members.filter((m) => !m.isYou);

/** The "added" line as this viewer reads it: "You added Sam", "Alice added you", "Alice added Sam". */
export function participantAddedLine(m: { author: MessageAuthor; subject: MessageSubject | null; isOwn: boolean }): string {
	return participantAddedText({
		actorName: fullName(m.author),
		subjectName: m.subject ? fullName(m.subject) : "someone",
		viewerIsActor: m.isOwn,
		viewerIsSubject: !!m.subject?.isYou,
	});
}

/**
 * Tab / row title. A DM is the other party's full name; a group is its name, or its members' short
 * names ("Sam, Pat & Portland Makers Guild", then "+N") when unnamed.
 */
export function conversationTitle(c: Pick<ConversationSummary | ConversationThreadData, "kind" | "name" | "members" | "deletedCounterpart">): string {
	const others = otherMembers(c);
	if (c.kind === "DIRECT" && c.deletedCounterpart === "PAGE") return "[page deleted]";
	if (c.kind === "DIRECT" && c.deletedCounterpart === "USER") return "[user deleted]";
	if (c.kind === "DIRECT") return others[0] ? fullName(others[0]) : "Conversation";
	if (c.name) return c.name;
	if (others.length === 0) return "Just you";
	const names = others.slice(0, 3).map(shortName);
	if (others.length > 3) return `${names.join(", ")} +${others.length - 3}`;
	return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
