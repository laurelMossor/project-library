"use client";

import Link from "next/link";
import { LOGIN } from "@/lib/const/routes";

/**
 * Placeholder for NavProfileTag when unauthenticated — same nav slot, prompts login.
 */
export function NavProfileShell() {
	return (
		<Link
			href={LOGIN}
			className="flex w-[260px] shrink-0 items-center justify-center px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 text-center transition-colors hover:bg-white hover:opacity-90 min-h-[4.25rem]"
		>
			<span className="text-rich-brown leading-snug">
				<p>Log in or Sign up</p>
				<p className="text-xs">The Project Library is best with an account!</p>
			</span>
		</Link>
	);
}
