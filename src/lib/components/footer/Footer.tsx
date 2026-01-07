import Link from "next/link";
import { BugReportIcon } from "../icons/icons";
import { ABOUT, BUG_REPORT_FORM, FEEDBACK_SURVEY, GITHUB_REPO, INSTAGRAM } from "@/lib/const/routes";

export function Footer() {
	return (
		<footer className="border-t border-soft-grey mt-auto bg-grey-white">
			<div className="max-w-6xl mx-auto px-8 py-6">
				<div className="flex flex-col gap-4 items-center text-sm">
					<div className="flex flex-wrap gap-6 justify-center">
						<Link href={ABOUT} className="text-rich-brown hover:underline">
							About &amp; Community Guidelines
						</Link>
						<a
							href={FEEDBACK_SURVEY}
							target="_blank"
							rel="noopener noreferrer"
							className="text-rich-brown hover:underline"
						>
							Feedback Survey
						</a>
						<a
							href={BUG_REPORT_FORM}
							target="_blank"
							rel="noopener noreferrer"
							className="text-rich-brown hover:underline flex items-center gap-2"
						>
							<BugReportIcon />Bug Report
						</a>
					</div>
					<div className="flex gap-6 justify-center">
						<a
							href={GITHUB_REPO}
							target="_blank"
							rel="noopener noreferrer"
							className="text-rich-brown hover:underline"
						>
							GitHub
						</a>
						<a
							href={INSTAGRAM}
							target="_blank"
							rel="noopener noreferrer"
							className="text-rich-brown hover:underline"
						>
							Instagram
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}

