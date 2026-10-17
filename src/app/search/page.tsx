import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileSearchPage } from "@/lib/components/search/ProfileSearchPage";
import { suggestProfiles } from "@/lib/utils/server/search";
import { getViewerContext } from "@/lib/utils/server/visibility";

export default async function SearchPage() {
	// Open to signed-out visitors too: the viewer only decides who is left out and who comes first.
	const suggestions = await suggestProfiles(await getViewerContext());
	return (
		<CenteredLayout maxWidth="6xl">
			<ProfileSearchPage suggestions={suggestions} />
		</CenteredLayout>
	);
}
