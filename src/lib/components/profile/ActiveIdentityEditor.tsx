"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { authFetch } from "@/lib/utils/auth-client";
import { API_ME_USER, API_ME_PAGE, API_ME_HANDLE, API_ME_PAGE_HANDLE } from "@/lib/const/routes";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { PublicUser } from "@/lib/types/user";
import type { PublicPage } from "@/lib/types/page";

export type IdentityEntity =
	| { type: "user"; data: PublicUser }
	| { type: "page"; data: PublicPage };

type ActiveIdentityEditorProps = {
	footer?: "bar" | "none";
	children: (entity: IdentityEntity, helpers: { merge: (patch: Record<string, unknown>) => void }) => ReactNode;
};

/**
 * Loads, saves, and merges the active identity (user or page). Settings and
 * setup both render their fields through this, so the fetch/PUT/merge lives once.
 */
export function ActiveIdentityEditor({ footer = "bar", children }: ActiveIdentityEditorProps) {
	const { activePageId, switchProfile, loading: profileLoading } = useActiveProfile();
	const [entity, setEntity] = useState<IdentityEntity | null>(null);
	const [loading, setLoading] = useState(true);

	const isPage = !!activePageId;
	const saveUrl = isPage ? API_ME_PAGE : API_ME_USER;

	useEffect(() => {
		setLoading(true);
		fetch(saveUrl)
			.then((r) => {
				// The page we were acting as is gone (deleted elsewhere). Fall back to the
				// personal profile instead of leaving settings with nothing to load.
				if (r.status === 404 && isPage) void switchProfile(null);
				return r.ok ? r.json() : null;
			})
			.then((data) => setEntity(data ? (isPage ? { type: "page", data } : { type: "user", data }) : null))
			.finally(() => setLoading(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activePageId]);

	function merge(patch: Record<string, unknown>) {
		setEntity((prev) => {
			if (!prev) return prev;
			return prev.type === "user"
				? { type: "user", data: { ...prev.data, ...patch } }
				: { type: "page", data: { ...prev.data, ...patch } };
		});
	}

	if (profileLoading || loading) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}
	if (!entity) {
		return <p className="text-sm text-gray-500 text-center py-12">Could not load profile data.</p>;
	}

	// A handle change also moves the cross-entity Handle row, so it saves through its own
	// endpoint. The session treats it as an ordinary field; this is where it's split out.
	// Re-saving a handle that already took effect is a no-op, so a retry after a later
	// failure is safe.
	const handleSave = async (payload: SavePayload) => {
		const { handle, ...otherFields } = payload.fields;
		let savedHandle: string | null = null;
		if (typeof handle === "string") {
			const res = await authFetch(isPage ? API_ME_PAGE_HANDLE : API_ME_HANDLE, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ handle }),
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error || "Failed to update handle");
			savedHandle = body.handle ?? handle;
		}

		let saved: Record<string, unknown> = {};
		if (Object.keys(otherFields).length > 0 || payload.elements) {
			const res = await authFetch(saveUrl, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...payload, fields: otherFields }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Failed to save");
			}
			saved = await res.json();
		}
		return savedHandle ? { ...saved, handle: savedHandle } : saved;
	};

	return (
		<InlineEditSession
			footer={footer}
			resource={entity.data as unknown as Record<string, unknown>}
			onSave={handleSave as (payload: SavePayload) => Promise<Record<string, unknown> | void>}
			onSaved={(updated) => merge(updated)}
			canEdit
		>
			{children(entity, { merge })}
		</InlineEditSession>
	);
}
