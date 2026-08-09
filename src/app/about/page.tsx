import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";

export default function AboutPage() {
	return (
		<CenteredLayout maxWidth="3xl">
			<HeadingTitle title="About" />
			<p className="text-warm-grey mt-1">Coming soon</p>
		</CenteredLayout>
	);
}
