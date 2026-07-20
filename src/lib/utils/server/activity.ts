// ⚠️ SERVER-ONLY: Activity notification seam.
//
// The single choke point for "something happened that a user might want to be
// notified about" — a follow, a join request, a comment. Today it's a no-op that
// only logs; the real Activity Notifications dispatcher is deferred (NETWERK
// backlog). Centralized here so wiring delivery later is one function body, not a
// scatter of call sites across requests.ts / comment.ts / etc.
import { logAction } from "./log";

export type EntityRef = { type: "USER" | "PAGE"; id: string };

/** Record that `actor` did `action` toward `target`. No-op dispatch for now. */
export function emitActivity(action: string, actor: EntityRef, target: EntityRef): void {
  logAction(action, actor.type === "USER" ? actor.id : undefined, { actor, target });
}
