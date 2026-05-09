import Link from "next/link";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { ABOUT, FEEDBACK_SURVEY } from "@/lib/const/routes";

function PlaceholderSection({ title, items }: { title: string; items: string[] }) {
	return (
		<section>
			<h2 className="text-xl font-semibold mb-3">{title}</h2>
			<div className="bg-ash-green/30 rounded-lg p-4 border border-ash-green">
				<ul className="list-disc list-inside space-y-2 text-sm text-warm-grey italic">
					{items.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</div>
		</section>
	);
}

export default function GuidelinesPage() {
	return (
		<CenteredLayout maxWidth="3xl">
			<HeadingTitle title="Community Guidelines" />
			<p className="text-warm-grey mt-1 mb-8">
				A few shared expectations for how we treat each other and this space.
			</p>

			<div className="space-y-8 text-rich-brown">
				<PlaceholderSection
					title="Respect & Kindness"
					items={[
						"Treat all members with respect",
						"Constructive feedback is welcome; personal attacks are not",
						"Assume good intent",
					]}
				/>

				<PlaceholderSection
					title="Sharing & Authenticity"
					items={[
						"Share your genuine work and experiences",
						"Give credit where it's due",
						"Only share content you have the right to share",
					]}
				/>

				<PlaceholderSection
					title="Privacy & Safety"
					items={[
						"Don't share others' personal information",
						"Report concerning behavior",
						"Keep the community safe for all members",
					]}
				/>

				<PlaceholderSection
					title="Content & Communication"
					items={[
						"Keep posts relevant to creative work, learning, and community",
						"No spam or self-promotion that doesn't contribute",
						"Be thoughtful in messages and comments",
					]}
				/>

				<PlaceholderSection
					title="What Happens If Guidelines Are Broken"
					items={[
						"How issues are addressed (conversation first)",
						"Escalation path for repeated or serious violations",
						"Who to contact",
					]}
				/>

				<section>
					<p className="text-sm text-warm-grey">
						Have questions or concerns?{" "}
						<a
							href={FEEDBACK_SURVEY}
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-rich-brown"
						>
							Reach out through the feedback survey
						</a>
						.
					</p>
				</section>

				<div className="mt-8 pt-6 border-t border-soft-grey">
					<Link href={ABOUT} className="text-sm underline">
						About The Project Library
					</Link>
				</div>
			</div>
		</CenteredLayout>
	);
}
