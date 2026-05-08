import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { ProfileSearchPage } from "@/lib/components/search/ProfileSearchPage";

export default function SearchPage() {
	return (
		<CenteredLayout maxWidth="6xl">
			<ProfileSearchPage />
		</CenteredLayout>
	);
}
