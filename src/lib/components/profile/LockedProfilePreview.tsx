import { ProfileEntity, getProfileDisplayName } from "@/lib/types/profile";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileIdentityBlock } from "./ProfileIdentityBlock";

type LockedProfilePreviewProps = {
	profile: ProfileEntity;
};

/**
 * Header-only stub for a PRIVATE profile the viewer can't (yet) see.
 *
 * Renders only the safe identity block (name/handle/avatar + request affordance)
 * plus a notice — never the private content, and never headline/location/bio.
 * PRIVATE profiles ARE discoverable in search now, so this stub is reachable by
 * anyone; it must therefore reveal nothing beyond identity (hence identityOnly).
 */
export function LockedProfilePreview({ profile }: LockedProfilePreviewProps) {
	const isPage = profile.type === "PAGE";
	const displayName = getProfileDisplayName(profile);

	return (
		<CenteredLayout maxWidth="6xl">
			<div className="flex flex-col gap-6">
				<ProfileIdentityBlock profile={profile} identityOnly />

				<div className="rounded-lg border border-soft-grey/60 bg-soft-grey/10 px-6 py-8 text-center">
					<p className="text-base font-semibold text-rich-brown">This profile is private</p>
					<p className="mt-1 text-sm text-dusty-grey">
						{isPage
							? `Request to follow to see what ${displayName} is sharing.`
							: `Request to follow to see ${displayName}'s profile.`}
					</p>
				</div>
			</div>
		</CenteredLayout>
	);
}
