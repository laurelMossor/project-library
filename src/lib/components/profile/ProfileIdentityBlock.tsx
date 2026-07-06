import { ProfileEntity } from "@/lib/types/profile";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileButtons } from "./ProfileButtons";
import { JoinButton } from "./JoinButton";

/**
 * Public profile header + follow/join action column for a non-owner viewer.
 * Shared by the full profile render ([handle]/page.tsx) and the locked-preview
 * stub, so the header/button layout lives in exactly one place.
 */
export function ProfileIdentityBlock({ profile, identityOnly = false }: { profile: ProfileEntity; identityOnly?: boolean }) {
	const isPage = profile.type === "PAGE";
	const id = profile.data.id;

	return (
		<div className="flex items-start justify-between gap-4">
			<ProfileHeader profile={profile} isOwnProfile={false} identityOnly={identityOnly} />
			<div className="flex flex-col gap-2 w-36 shrink-0">
				<ProfileButtons entityId={id} entityType={isPage ? "page" : "user"} />
				{isPage && <JoinButton pageId={id} />}
			</div>
		</div>
	);
}
