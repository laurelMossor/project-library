"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { FormError } from "@/lib/components/forms/FormError";
import { API_PAGES, LOGIN_WITH_CALLBACK, PAGE_NEW, SETUP } from "@/lib/const/routes";

// React strict mode runs the effect twice. A second real visit is much later.
let lastCreateAt = 0;

/**
 * There is no name form here. A page is created with a generated handle and
 * the person lands on /setup, the same long page a new user gets.
 */
export default function NewPagePage() {
	const router = useRouter();
	const { switchProfile } = useActiveProfile();
	const [error, setError] = useState("");

	useEffect(() => {
		const now = Date.now();
		if (now - lastCreateAt < 1000) return;
		lastCreateAt = now;

		(async () => {
			const res = await fetch(API_PAGES, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: `page-${Math.random().toString(36).slice(2, 8)}` }),
			});
			if (!res.ok) {
				if (res.status === 401) {
					router.replace(LOGIN_WITH_CALLBACK(PAGE_NEW));
					return;
				}
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Failed to create page");
				return;
			}
			const page = await res.json();
			const switched = await switchProfile(page.id);
			if (!switched) {
				setError("The page was created, but switching into it failed. Open it from your pages list.");
				return;
			}
			router.replace(SETUP);
		})();
		// switchProfile's identity changes as soon as it starts, which would cancel this.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="mx-auto w-full max-w-lg px-4 py-16 text-center">
			{error ? <FormError error={error} /> : <p className="text-sm text-dusty-grey">Setting up your page…</p>}
		</div>
	);
}
