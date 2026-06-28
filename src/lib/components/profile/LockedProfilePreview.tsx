import { ProfileEntity, getProfileDisplayName } from "@/lib/types/profile";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileIdentityBlock } from "./ProfileIdentityBlock";

type LockedProfilePreviewProps = {
	profile: ProfileEntity;
};

/**
 * Header-only stub for a PRIVATE profile the viewer can't (yet) see.
 *
 * Renders only the safe identity block (header + request affordance) plus a
 * notice — never the private content (no ProfileBody, no collection). The
 * JSON/content routes still existence-deny, and PRIVATE profiles never surface
 * in search/lists, so this stub is only reachable by someone who has the handle.
 */
export function LockedProfilePreview({ profile }: LockedProfilePreviewProps) {
	const isPage = profile.type === "PAGE";
	const displayName = getProfileDisplayName(profile);

	return (
		<CenteredLayout maxWidth="6xl">
			<div className="flex flex-col gap-6">
				<ProfileIdentityBlock profile={profile} />

				<div className="rounded-lg border border-soft-grey/60 bg-soft-grey/10 px-6 py-8 text-center">
					<p className="text-base font-semibold text-rich-brown">This profile is private</p>
					<p className="mt-1 text-sm text-dusty-grey">
						{isPage
							? `Request to join to see what ${displayName} is sharing.`
							: `Request to follow to see ${displayName}'s profile.`}
					</p>
				</div>
			</div>
		</CenteredLayout>
	);
}
