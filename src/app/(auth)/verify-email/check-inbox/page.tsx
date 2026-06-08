"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LOGIN } from "@/lib/const/routes";
import { ResendVerification } from "@/lib/components/auth/ResendVerification";

function CheckInbox() {
	const searchParams = useSearchParams();
	const email = searchParams.get("email")?.trim() ?? "";

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-4 text-center">
				<h1 className="text-2xl font-bold">Check your inbox</h1>
				<p className="text-misty-forest">
					We sent a verification link{email ? ` to ${email}` : ""}. Click it to
					activate your account, then log in.
				</p>
				<p className="text-sm text-misty-forest">
					Didn&apos;t get it? Check spam, or resend below.
				</p>
				<ResendVerification initialEmail={email} />
				<p className="text-sm">
					<Link href={LOGIN} className="underline">
						Back to log in
					</Link>
				</p>
			</div>
		</main>
	);
}

export default function CheckInboxPage() {
	return (
		<Suspense
			fallback={
				<main className="flex min-h-screen items-center justify-center p-4">
					<p className="text-gray-600">Loading…</p>
				</main>
			}
		>
			<CheckInbox />
		</Suspense>
	);
}
