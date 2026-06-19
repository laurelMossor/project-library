"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LOGIN } from "@/lib/const/routes";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { ResendVerification } from "@/lib/components/auth/ResendVerification";

function CheckInbox() {
	const searchParams = useSearchParams();
	const email = searchParams.get("email")?.trim() ?? "";

	return (
		<AuthCard>
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
		</AuthCard>
	);
}

export default function CheckInboxPage() {
	return (
		<Suspense
			fallback={
				<AuthCard>
					<p className="text-gray-600">Loading…</p>
				</AuthCard>
			}
		>
			<CheckInbox />
		</Suspense>
	);
}
