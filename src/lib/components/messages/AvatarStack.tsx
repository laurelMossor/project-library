import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import type { CardEntity } from "@/lib/types/card";

/**
 * Overlapping avatars for a group (up to three, then a "+N" chip). A single entity renders as a plain
 * avatar, so DMs and groups share one row layout.
 */
export function AvatarStack({ entities, total }: { entities: (CardEntity | null)[]; total?: number }) {
	const shown = entities.filter((e): e is CardEntity => !!e).slice(0, 3);
	const extra = (total ?? entities.length) - shown.length;

	if (shown.length <= 1 && extra <= 0) {
		return shown[0]
			? <ProfilePicture entity={shown[0]} size="md" asLink={false} />
			: <div className="w-12 h-12 rounded-full bg-soft-grey shrink-0" />;
	}

	return (
		<div className="relative w-12 h-12 shrink-0" aria-hidden>
			{shown.map((e, i) => (
				<ProfilePicture
					key={e.id}
					entity={e}
					size="sm"
					asLink={false}
					// Diagonal cascade inside the 48px slot, each ringed so overlaps read cleanly.
					className={`absolute ring-2 ring-grey-white ${["left-0 top-0", "right-0 top-2", "left-2 bottom-0"][i]}`}
				/>
			))}
			{extra > 0 && (
				<span className="absolute -right-1 -bottom-1 min-w-5 h-5 px-1 rounded-full bg-moss-green text-grey-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-grey-white">
					+{extra}
				</span>
			)}
		</div>
	);
}
