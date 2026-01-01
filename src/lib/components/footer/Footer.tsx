import Link from "next/link";
import { BugReportIcon } from "../icons/icons";

export function Footer() {
	return (
		<footer className="border-t border-soft-grey mt-auto bg-grey-white">
			<div className="max-w-6xl mx-auto px-8 py-6">
				<div className="flex flex-wrap gap-6 justify-center text-sm">
					<Link href="/about" className="text-rich-brown hover:underline">
						Community Guidelines
					</Link>
					<a
						href="https://github.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-rich-brown hover:underline"
					>
						GitHub
					</a>
					<a
						href="https://instagram.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-rich-brown hover:underline"
					>
						Instagram
					</a>
					<a
						href="https://forms.google.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-rich-brown hover:underline"
					>
						Feedback Survey
					</a>
					
					<a
						href="https://docs.google.com/forms/d/e/1FAIpQLScfIyo6yd_EvuJw4xJH-FFBgNid73QIGkAWaxUHVnSpgPbE4Q/viewform?usp=dialog"
						target="_blank"
						rel="noopener noreferrer"
						className="text-rich-brown hover:underline"
					>
						<BugReportIcon />Bug Report
					</a>
				</div>
			</div>
		</footer>
	);
}

