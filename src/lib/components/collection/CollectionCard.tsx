"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnyCollectionItem, CollectionItem, isEvent, isAbout, isPastEvent, AboutCollectionItem } from "@/lib/types/collection";
import type { EventItem } from "@/lib/types/event";
import { ProfilePicture } from "../profile/ProfilePicture";
import { Tags } from "../tag/Tag";
import { truncateText } from "@/lib/utils/text";
import { formatDateTime } from "@/lib/utils/datetime";
import { LocalDate } from "@/lib/components/ui/LocalDate";
import ImageCarousel from "../images/ImageCarousel";
import { EVENT_DETAIL, POST_DETAIL, PROFILE_ABOUT, PUBLIC_PROFILE } from "@/lib/const/routes";
import { updatePostAction } from "@/lib/actions/post";
import { updateEventAction } from "@/lib/actions/event";
import { useAction } from "@/lib/hooks/useAction";
import { MAX_PINNED_PER_PROFILE } from "@/lib/const/pin";
import { resolveCardIdentity } from "@/lib/types/card";
import { contentIdentity } from "@/lib/utils/content-identity";
import { AtSignIcon, PinIcon } from "../icons/icons";

export type PinConfig = {
	pinnedCount: number;
};

type CollectionCardProps = {
	item: AnyCollectionItem;
	truncate?: boolean;
	showCaptions?: boolean;
	pinConfig?: PinConfig;
};

// TODO: rethink about card treatment
function AboutCard({ item }: { item: AboutCollectionItem }) {
	return (
		<Link
			href={PROFILE_ABOUT(item.handle)}
			className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col gap-2 no-underline"
		>
			<p className="text-xs font-medium uppercase tracking-wide text-dusty-grey">About</p>
			<h2 className="text-xl font-semibold">About {item.displayName}</h2>
			{item.excerpt && (
				<p className="text-warm-grey text-sm line-clamp-3">{item.excerpt}</p>
			)}
			<span className="text-sm text-moss-green hover:text-rich-brown transition-colors mt-auto">
				Read more →
			</span>
		</Link>
	);
}

export function CollectionCard({ item, truncate = true, showCaptions = false, pinConfig }: CollectionCardProps) {
	const router = useRouter();
	const { run: pinPost, pending: postPinPending } = useAction(updatePostAction);
	const { run: pinEvent, pending: eventPinPending } = useAction(updateEventAction);
	const pinPending = postPinPending || eventPinPending;

	if (isAbout(item)) {
		return <AboutCard item={item} />;
	}

	const ri = item as CollectionItem;
	const isEventItem = isEvent(item);
	const ev = isEventItem ? (ri as EventItem) : null;
	const detailUrl = isEventItem ? EVENT_DETAIL(ri.id) : POST_DETAIL(ri.id);

	const { voice, placedIn } = contentIdentity(ri);
	const { name: displayName, handle, href: profileHref } = resolveCardIdentity(voice);

	const isPinned = Boolean(ri.pinnedAt);
	const isDraft = ri.status === "DRAFT";
	const isPublished = ri.status === "PUBLISHED";
	const isPast = isPastEvent(ri);
	const canPin = ri.canPin === true;
	const atPinLimit = !!pinConfig && pinConfig.pinnedCount >= MAX_PINNED_PER_PROFILE && !isPinned;

	// Pinning is the same update action as any other edit; it refreshes the profile, which re-sorts.
	async function handleTogglePin() {
		if (atPinLimit || pinPending) return;
		const data = { pinnedAt: isPinned ? null : new Date().toISOString() };
		await (isEventItem ? pinEvent({ id: ri.id, data }) : pinPost({ id: ri.id, data }));
	}

	return (
		<div
			className={`group border rounded p-4 hover:shadow-lg transition-shadow flex flex-col cursor-pointer${isPast ? " opacity-50" : ""}`}
			onClick={() => router.push(detailUrl)}
		>
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					<ProfilePicture entity={voice} size="md" />
					<div className="flex-1 min-w-0">
						{ri.title && <h2 className="text-xl font-semibold mb-2">{ri.title}</h2>}
					</div>
					{isDraft && (
						<span className="flex-shrink-0 text-xs font-medium uppercase tracking-wide text-dusty-grey border border-dusty-grey rounded px-1.5 py-0.5">
							Draft
						</span>
					)}
					{canPin && (
						<button
							onClick={(e) => { e.stopPropagation(); handleTogglePin(); }}
							disabled={atPinLimit}
							title={atPinLimit ? `Max ${MAX_PINNED_PER_PROFILE} posts pinned` : isPinned ? "Unpin" : "Pin to top of profile"}
							className={`flex-shrink-0 p-1 rounded transition-all ${
								isPinned
									? "opacity-100 text-rich-brown hover:text-warm-grey"
									: atPinLimit
									? "opacity-0 group-hover:opacity-100 text-soft-grey cursor-not-allowed"
									: "opacity-0 group-hover:opacity-100 text-misty-forest hover:text-rich-brown"
							}`}
						>
							<PinIcon className="w-4 h-4" pinned={isPinned} />
						</button>
					)}
				</div>
			</div>

			{ri.content && (
				<p className="text-warm-grey text-sm mb-2">
					{truncate ? truncateText(ri.content, 250) : ri.content}
				</p>
			)}

			{ev && (
				<div className="mb-2 text-sm text-warm-grey">
					<p className="font-medium flex items-center gap-2">
						📅{" "}
						{ev.eventTimezone ? (
							formatDateTime(ev.eventDateTime, ev.eventTimezone)
						) : (
							<LocalDate value={ev.eventDateTime} mode="absolute" />
						)}
						{isPast && <span className="text-xs font-medium uppercase tracking-wide text-dusty-grey border border-dusty-grey rounded px-1.5 py-0.5">Past</span>}
					</p>
					<p className="text-xs">📍 {ev.location}</p>
				</div>
			)}

			{handle && (
				<div className="flex flex-row items-center gap-2 mb-2">
					<div className="flex items-center gap-1">
						<AtSignIcon className="w-3 h-3 text-misty-forest" />
						<Link
							href={profileHref}
							onClick={(e) => e.stopPropagation()}
							className="text-sm text-rich-brown hover:underline"
						>
							{displayName}
						</Link>
						{placedIn && (
							<Link
								href={PUBLIC_PROFILE(placedIn.handle)}
								onClick={(e) => e.stopPropagation()}
								className="text-sm text-dusty-grey hover:underline"
							>
								{" › "}{placedIn.name}
							</Link>
						)}
					</div>
				</div>
			)}

			{(() => {
				const updateCount = ri._count?.updates ?? 0;
				const commentCount = ri._count?.comments ?? 0;
				if (!updateCount && !commentCount) return null;
				return (
					<div className="mt-2 mb-2" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center gap-2 text-xs font-medium text-misty-forest">
							{updateCount > 0 && (
								<Link href={detailUrl} className="hover:text-rich-brown hover:underline">
									{updateCount} {updateCount === 1 ? "update" : "updates"}
								</Link>
							)}
							{updateCount > 0 && commentCount > 0 && <span aria-hidden="true">·</span>}
							{commentCount > 0 && (
								<Link href={`${detailUrl}#comments`} className="hover:text-rich-brown hover:underline">
									{commentCount} {commentCount === 1 ? "comment" : "comments"}
								</Link>
							)}
						</div>
						{ri.recentUpdate && (
							<div className="mt-1 border-l-2 border-soft-grey pl-3">
								<p className="text-sm text-warm-grey whitespace-pre-wrap">
									{truncate ? truncateText(ri.recentUpdate.content, 120) : ri.recentUpdate.content}
								</p>
							</div>
						)}
					</div>
				);
			})()}

			{ri.images && ri.images.length > 0 && (
				<div className="mb-4" onClick={(e) => e.stopPropagation()}>
					<ImageCarousel images={ri.images} showCaptions={showCaptions} />
				</div>
			)}

			<Tags item={ri} />

			{isPublished && (
				<LocalDate
					value={ri.createdAt}
					mode="absolute"
					prefix="Posted "
					className="text-xs text-dusty-grey mt-2"
				/>
			)}
		</div>
	);
}
