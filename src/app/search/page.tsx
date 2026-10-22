import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileSearchPage } from "@/lib/components/search/ProfileSearchPage";
import { suggestProfiles } from "@/lib/utils/server/search";
import { getViewerContext } from "@/lib/utils/server/visibility";
import { actingRef, getSessionContext } from "@/lib/utils/server/session";

export default async function SearchPage() {
	// Open to signed-out visitors too: the viewer only decides who is left out and who comes first.
	// The cards' Follow state is the acting identity's, matching what their buttons do.
	const [viewer, ctx] = await Promise.all([getViewerContext(), getSessionContext()]);
	const suggestions = await suggestProfiles(viewer, ctx ? await actingRef(ctx) : null);
	return (
		<CenteredLayout maxWidth="6xl">
			<ProfileSearchPage suggestions={suggestions} />
		</CenteredLayout>
	);
}
