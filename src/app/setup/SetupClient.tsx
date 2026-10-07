"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { ActiveIdentityEditor, type IdentityEntity } from "@/lib/components/profile/ActiveIdentityEditor";
import { AboutFields } from "@/lib/components/profile/AboutFields";
import { EditableIdentityBlock } from "@/lib/components/profile/EditableIdentityBlock";
import { PersonalInfoSection } from "@/lib/components/profile/PersonalInfoSection";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { NotificationSettingsForm } from "@/app/settings/profile/NotificationSettingsForm";
import { Button } from "@/lib/components/ui/Button";
import { useDiscardOnLeave } from "@/lib/hooks/useDiscardOnLeave";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { API_ME_SETUP_COMPLETE, API_ME_USER, EXPLORE_PAGE, PUBLIC_PROFILE, SETUP, WELCOME_PAGE } from "@/lib/const/routes";
import type { PublicUser } from "@/lib/types/user";

/** A new account has no pages yet, so the sole-admin list the delete route expects is empty. */
async function discardAccount() {
	const res = await fetch(API_ME_USER, {
		method: "DELETE",
		keepalive: true,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ expectedPageIds: [] }),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(data.error || "Couldn't discard this account");
	}
}

function leavingHref(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) return null;
	const link = target.closest("a");
	if (!link || link.target === "_blank") return null;
	const href = link.getAttribute("href");
	if (!href || href.startsWith("#")) return null;
	let url: URL;
	try {
		url = new URL(href, window.location.href);
	} catch {
		return null;
	}
	if (url.origin !== window.location.origin) return null;
	if (url.pathname === SETUP || url.pathname.startsWith(`${SETUP}/`)) return null;
	return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The review a new account gets after verifying its email. The account already exists.
 * It is only kept once the person says it looks good. Cancel or leaving deletes it.
 * Pages are a separate screen: /pages/new creates one immediately and deletes it the same way.
 */
export function SetupClient({ next }: { next: string }) {
	const [leaveError, setLeaveError] = useState<string | null>(null);
	const { keep, discard } = useDiscardOnLeave(discardAccount);

	const leaveTo = useCallback(async (href: string) => {
		setLeaveError(null);
		try {
			const discarded = await discard();
			if (!discarded) return;
			await signOut({ redirect: false });
			window.location.assign(href);
		} catch (e) {
			setLeaveError(e instanceof Error ? e.message : "Couldn't discard this account");
		}
	}, [discard]);

	useEffect(() => {
		// One extra history entry so Back is a leave we can finish before the previous page loads.
		// Otherwise the setup gate would send a still-unconfirmed session straight back here.
		if (!window.history.state?.setupGuard) {
			window.history.pushState({ setupGuard: true }, "");
		}
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const href = leavingHref(event.target);
			if (!href) return;
			event.preventDefault();
			event.stopPropagation();
			void leaveTo(href);
		};
		const onPop = () => { void leaveTo(WELCOME_PAGE); };
		document.addEventListener("click", onClick, true);
		window.addEventListener("popstate", onPop);
		return () => {
			document.removeEventListener("click", onClick, true);
			window.removeEventListener("popstate", onPop);
		};
	}, [leaveTo]);

	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-10">
			<h1 className="text-2xl font-bold mb-2">Set up your account</h1>
			<p className="text-sm text-gray-500 mb-8">
				Here is what you picked at signup. This account is only kept once you say it looks good. Cancel or leave and it is deleted.
			</p>
			{leaveError && <p role="alert" className="text-sm text-novel-red mb-4">{leaveError}</p>}
			<ActiveIdentityEditor footer="none">
				{(entity, { merge }) =>
					entity.type === "user"
						? <SetupFields entity={entity} merge={merge} next={next} keep={keep} onCancel={() => leaveTo(WELCOME_PAGE)} />
						: null
				}
			</ActiveIdentityEditor>
		</div>
	);
}

function SetupFields({
	entity,
	merge,
	next,
	keep,
	onCancel,
}: {
	entity: Extract<IdentityEntity, { type: "user" }>;
	merge: (patch: Record<string, unknown>) => void;
	next: string;
	keep: () => void;
	onCancel: () => void;
}) {
	const user = entity.data;
	const session = useInlineEditSession();
	const { value: handle } = useInlineField<string>("handle", user.handle);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function looksGood() {
		setBusy(true);
		setError(null);
		try {
			// A failed save stays here with its message; setup is only marked done once everything saved.
			if (!(await session?.saveAll())) {
				setBusy(false);
				return;
			}
			const res = await fetch(API_ME_SETUP_COMPLETE, { method: "POST" });
			if (!res.ok) throw new Error("Couldn't finish setup");
			// Confirmed, so the unmount that follows must not delete the account.
			keep();
			// Full load, same reason as LeaveSetup: a client navigation would keep the
			// layout that still has needsSetup and bounce right back to this page.
			const generic = !next || next === "/" || next === WELCOME_PAGE || next === EXPLORE_PAGE;
			window.location.assign(generic ? PUBLIC_PROFILE(handle || user.handle) : next);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't finish setup");
			setBusy(false);
		}
	}

	const shownError = error ?? session?.error;

	return (
		<div>
			<EditableIdentityBlock entity={entity} merge={merge} followHandle />

			<AboutFields
				headline={user.headline}
				bio={user.bio}
				location={user.location}
				interests={user.interests}
				bioPlaceholder="Tell people about yourself"
			/>

			<VisibilityField
				profileSectionTitle="Profile Visibility"
				contentSectionTitle="Content Visibility"
				initialProfileVisibility={user.profileVisibility ?? "PUBLIC"}
				initialContentVisibility={user.contentVisibility ?? "LISTED"}
			/>

			<SettingsSection title="Email notifications">
				<NotificationSettingsForm />
			</SettingsSection>

			<PersonalInfoSection user={user as PublicUser & { email?: string }} />

			{shownError && <p role="alert" className="text-sm text-novel-red mb-4">{shownError}</p>}
			<div className="flex gap-3">
				<Button onClick={looksGood} loading={busy}>Looks good</Button>
				<Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
			</div>
		</div>
	);
}
