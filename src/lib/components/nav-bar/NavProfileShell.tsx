"use client";

import Link from "next/link";
import { LOGIN } from "@/lib/const/routes";

/**
 * Placeholder for NavProfileTag when unauthenticated — mirrors the logged-in trigger size at each breakpoint.
 */
export function NavProfileShell() {
	return (
		<>
			{/* Mobile: compact pill matching the avatar-only trigger */}
			<Link
				href={LOGIN}
				className="sm:hidden px-3 py-1.5 rounded-full border border-soft-grey/60 bg-white/70 text-xs text-rich-brown hover:bg-white transition-colors text-center"
			>
				Sign up!
			</Link>

			{/* Desktop: original CTA */}
			<Link
				href={LOGIN}
				className="hidden sm:flex w-[260px] shrink-0 items-center justify-center px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 text-center transition-colors hover:bg-white hover:opacity-90 min-h-[4.25rem]"
			>
				<span className="text-rich-brown leading-snug">
					<p>Log in or Sign up</p>
					<p className="text-xs">The Project Library is best with an account!</p>
				</span>
			</Link>
		</>
	);
}
