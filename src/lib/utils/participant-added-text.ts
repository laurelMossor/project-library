// Single source of truth for the "added to a group message" line. The thread, the inbox preview, and the
// email all build their text here, so the three never drift. Pure and import-safe on client and server —
// takes already-resolved names, resolves no identities.

export interface ParticipantAddedTextInput {
	/** Who added them (already resolved: a name, "A page", or "Someone"). */
	actorName: string;
	/** Who was added (already resolved). */
	subjectName: string;
	/** The viewer is the one who added them. */
	viewerIsActor?: boolean;
	/** The viewer is the one who was added. */
	viewerIsSubject?: boolean;
}

/** "You added Sam" / "Alice added you" / "Alice added Sam". */
export function participantAddedText({ actorName, subjectName, viewerIsActor, viewerIsSubject }: ParticipantAddedTextInput): string {
	if (viewerIsActor) return `You added ${subjectName}`;
	if (viewerIsSubject) return `${actorName} added you`;
	return `${actorName} added ${subjectName}`;
}

/** The email line to the person who was added: "Alice added you to Book Club" (or "to a group message"). */
export function participantAddedEmailText(actorName: string, groupName: string | null): string {
	return `${participantAddedText({ actorName, subjectName: "you", viewerIsSubject: true })} to ${groupName || "a group message"}`;
}
