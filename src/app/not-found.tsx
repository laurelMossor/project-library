import Link from "next/link";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { EXPLORE_PAGE, BUG_REPORT_FORM } from "@/lib/const/routes";

export default function NotFound() {
	return (
		<CenteredLayout maxWidth="2xl">
			<div className="py-20 text-center">
				<h1 className="text-4xl font-bold text-rich-brown mb-4">
					Page not found
				</h1>
				<p className="text-warm-grey mb-8">
					We couldn&apos;t find what you were looking for. It may have been
					moved, or the link might be outdated.
				</p>
				<div className="flex flex-col gap-3 items-center">
					<Link
						href={EXPLORE_PAGE}
						className="text-rich-brown font-medium underline hover:text-moss-green transition-colors"
					>
						Back to Explore
					</Link>
					<a
						href={BUG_REPORT_FORM}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-dusty-grey hover:underline"
					>
						Something wrong? Report a bug
					</a>
				</div>
			</div>
		</CenteredLayout>
	);
}
