import Link from "next/link";

/** The one "← Back to …" link. Always sits above the page's main content. */
export function Breadcrumb({ href, label }: { href: string; label: string }) {
	return (
		<Link href={href} className="text-sm text-misty-forest hover:text-rich-brown hover:underline">
			← {label}
		</Link>
	);
}
