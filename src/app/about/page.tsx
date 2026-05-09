import Link from "next/link";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { HeadingTitle } from "@/lib/components/text/HeadingTitle";
import { GUIDELINES, FEEDBACK_SURVEY, BUG_REPORT_FORM } from "@/lib/const/routes";

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

export default function AboutPage() {
	return (
		<CenteredLayout maxWidth="3xl">
			<HeadingTitle title="About" />
			<p className="text-warm-grey mt-1 mb-8">
				Learn about The Project Library and why it exists.
			</p>

			<div className="space-y-8 text-rich-brown">
				<PlaceholderSection
					title="What is The Project Library?"
					items={[
						"One-line description of the platform's purpose",
						"Who it's for (creative individuals, makers, learners)",
						"What makes it different from other platforms",
						"Current stage (closed beta, invite-only)",
					]}
				/>

				<PlaceholderSection
					title="What You Can Do Here"
					items={[
						"Share and track creative projects",
						"Create and discover events",
						"Connect with other makers and learners",
						"Exchange skills and resources",
						"Follow what interests you — no algorithm",
					]}
				/>

				<PlaceholderSection
					title="Our Values"
					items={[
						"Process over polish",
						"Mutuality and shared learning",
						"Authenticity in what you share",
						"Respect and kindness",
					]}
				/>

				<PlaceholderSection
					title="Who's Behind This"
					items={[
						"Brief creator/team intro",
						"Why this project exists",
						"Where it is in its development journey",
					]}
				/>

				<section>
					<h2 className="text-xl font-semibold mb-3">Get Involved</h2>
					<p className="text-base leading-relaxed">
						The Project Library is in early beta — your feedback shapes what
						this becomes. If you have thoughts, suggestions, or run into
						something unexpected:
					</p>
					<div className="flex gap-6 mt-3">
						<a
							href={FEEDBACK_SURVEY}
							target="_blank"
							rel="noopener noreferrer"
							className="text-rich-brown underline hover:text-moss-green transition-colors"
						>
							Feedback Survey
						</a>
						<a
							href={BUG_REPORT_FORM}
							target="_blank"
							rel="noopener noreferrer"
							className="text-rich-brown underline hover:text-moss-green transition-colors"
						>
							Bug Report
						</a>
					</div>
				</section>

				<div className="mt-8 pt-6 border-t border-soft-grey">
					<Link href={GUIDELINES} className="text-sm underline">
						Community Guidelines
					</Link>
				</div>
			</div>
		</CenteredLayout>
	);
}
