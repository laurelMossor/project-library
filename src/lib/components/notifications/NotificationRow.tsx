import Link from "next/link";
import type { NotificationItem } from "@/lib/types/notification";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { NotificationDot } from "@/lib/components/ui/NotificationDot";
import { formatRelativeTime } from "@/lib/utils/datetime";
import { notificationMessage } from "./notification-copy";

/**
 * One bell row: actor avatar + plain-language copy + relative time, linking to the notification's
 * deep link. Unread rows carry an accent + trailing dot. The avatar is NOT its own link (asLink
 * false) — the whole row is the Link, so no nested anchors.
 */
export function NotificationRow({ n, onNavigate }: { n: NotificationItem; onNavigate: () => void }) {
	return (
		<Link
			href={n.href}
			onClick={onNavigate}
			role="menuitem"
			className="flex items-start gap-3 px-4 py-3 text-left hover:bg-soft-grey transition-colors"
		>
			<span className="shrink-0 mt-0.5">
				{n.actor ? (
					<ProfilePicture entity={n.actor} size="sm" asLink={false} />
				) : (
					<span className="flex w-8 h-8 items-center justify-center rounded-full bg-ash-green text-grey-white text-xs">
						{(n.actorName ?? "?").charAt(0).toUpperCase()}
					</span>
				)}
			</span>

			<span className="min-w-0 flex-1">
				<span className={`block text-sm text-rich-brown ${n.readAt ? "" : "font-semibold"}`}>
					{notificationMessage(n)}
				</span>
				<span className="block text-xs text-ash-green mt-0.5">{formatRelativeTime(n.createdAt)}</span>
			</span>

			{!n.readAt && (
				<span className="mt-1.5 shrink-0">
					<NotificationDot label="Unread" />
				</span>
			)}
		</Link>
	);
}
