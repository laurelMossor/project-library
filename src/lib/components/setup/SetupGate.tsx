"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FORGOT_PASSWORD, LOGIN, RESET_PASSWORD, SETUP, SIGNUP, VERIFY_EMAIL } from "@/lib/const/routes";

const OPEN_PATHS = [SETUP, LOGIN, SIGNUP, FORGOT_PASSWORD, RESET_PASSWORD, VERIFY_EMAIL];

/** Sends an account that hasn't reviewed its settings to /setup, from any entry point. */
export function SetupGate({ needsSetup }: { needsSetup: boolean }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();

	useEffect(() => {
		if (!needsSetup) return;
		if (OPEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return;
		const here = searchParams.size ? `${pathname}?${searchParams.toString()}` : pathname;
		router.replace(`${SETUP}?next=${encodeURIComponent(here)}`);
	}, [needsSetup, pathname, searchParams, router]);

	return null;
}
