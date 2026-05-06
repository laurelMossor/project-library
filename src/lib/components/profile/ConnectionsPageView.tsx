"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TabbedPanel, TabDef } from "@/lib/components/layout/TabbedPanel";
import { ProfileTag } from "./ProfileTag";
import { CardEntity, CardPageWithRole, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { PUBLIC_PROFILE } from "@/lib/const/routes";

// ─── Types ──────────────────────────────────────────────────────────────────

type TopTab = "Followers" | "Following" | "Membership";

type ConnectionItem = {
	id: string;
	type: "USER" | "PAGE";
	followedAt: string;
	user: {
		id: string;
		handle: string;
		displayName: string | null;
		avatarImageId: string | null;
	} | null;
	page: {
		id: string;
		handle: string;
		name: string;
		avatarImageId: string | null;
	} | null;
};

type MemberItem = {
	id: string;
	role: string;
	user: {
		id: string;
		handle: string;
		displayName: string | null;
		avatarImageId: string | null;
	};
};

type PageMembershipItem = {
	id: string;
	role: string;
	page: {
		id: string;
		handle: string;
		name: string;
		avatarImageId: string | null;
	};
};

type ConnectionsData = {
	followers: ConnectionItem[];
	following: ConnectionItem[];
	membership: MemberItem[];
	memberOf: PageMembershipItem[];
};

// ─── Props ───────────────────────────────────────────────────────────────────

type ConnectionsPageViewProps = {
	entity: CardEntity;
	currentUserId: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TOP_TABS: TabDef<TopTab>[] = [
	{ id: "Followers", label: "Followers" },
	{ id: "Following", label: "Following" },
	{ id: "Membership", label: "Membership" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function MemberRowActions({ onRemove }: { onRemove: () => Promise<void> }) {
	const [removing, setRemoving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleRemove() {
		setRemoving(true);
		setError(null);
		try {
			await onRemove();
		} catch {
			setError("Failed to remove");
			setRemoving(false);
		}
	}

	return (
		<>
			{error && <p className="text-xs text-red-500">{error}</p>}
			<button
				onClick={handleRemove}
				disabled={removing}
				className="text-xs px-3 py-1 rounded border border-soft-grey/60 text-dusty-grey hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer"
			>
				{removing ? "Removing..." : "Remove"}
			</button>
		</>
	);
}

function EmptyMessage({ label }: { label: string }) {
	return <p className="text-sm text-dusty-grey text-center py-12">No {label.toLowerCase()} yet.</p>;
}

function ViewLink({ href }: { href: string }) {
	return (
		<Link
			href={href}
			className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors"
		>
			View
		</Link>
	);
}

function ConnectionList({ items, emptyLabel }: { items: ConnectionItem[]; emptyLabel: string }) {
	if (!items.length) return <EmptyMessage label={emptyLabel} />;
	return (
		<div className="p-5 space-y-2">
			{items.map((item) => {
				if (item.type === "USER" && item.user) {
					return (
						<ProfileTag
							key={item.id}
							entity={item.user}
							actions={<ViewLink href={PUBLIC_PROFILE(item.user.handle)} />}
						/>
					);
				}
				if (item.type === "PAGE" && item.page) {
					return (
						<ProfileTag
							key={item.id}
							entity={item.page}
							actions={<ViewLink href={PUBLIC_PROFILE(item.page.handle)} />}
						/>
					);
				}
				return null;
			})}
		</div>
	);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ConnectionsPageView({ entity, currentUserId }: ConnectionsPageViewProps) {
	const isPage = isCardPage(entity);
	const entityType = isPage ? "page" : "user";
	const role = isPage ? (entity as CardPageWithRole).role : undefined;
	const displayName = isPage ? entity.name : getCardUserDisplayName(entity);

	const leftTabs: TabDef<string>[] = [{ id: entity.id, label: displayName }];

	const [data, setData] = useState<ConnectionsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const base = entityType === "user" ? "users" : "pages";
				const [followersRes, followingRes, membershipRes] = await Promise.all([
					fetch(`/api/${base}/${entity.id}/followers`),
					fetch(`/api/${base}/${entity.id}/following`),
					entityType === "page"
						? fetch(`/api/pages/${entity.id}/members`)
						: fetch(`/api/users/${entity.id}/memberships`),
				]);

				const followers = followersRes.ok ? (await followersRes.json()).followers ?? [] : [];
				const following = followingRes.ok ? (await followingRes.json()).following ?? [] : [];
				let membership: MemberItem[] = [];
				let memberOf: PageMembershipItem[] = [];

				if (entityType === "page" && membershipRes.ok) {
					membership = (await membershipRes.json()) as MemberItem[];
				} else if (entityType === "user" && membershipRes.ok) {
					memberOf = (await membershipRes.json()).memberships ?? [];
				}

				setData({ followers, following, membership, memberOf });
			} catch {
				setError("Failed to load connections");
			} finally {
				setLoading(false);
			}
		}
		load();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entity.id]);

	function removeMember(userId: string) {
		return async () => {
			const res = await fetch(`/api/pages/${entity.id}/members/${userId}`, { method: "DELETE" });
			if (!res.ok) throw new Error(`Remove failed: ${res.status}`);
			setData((prev) =>
				prev ? { ...prev, membership: prev.membership.filter((m) => m.user.id !== userId) } : prev
			);
		};
	}

	function getCount(_leftId: string, top: TopTab): number {
		if (!data) return 0;
		if (top === "Followers") return data.followers.length;
		if (top === "Following") return data.following.length;
		return entityType === "user" ? data.memberOf.length : data.membership.length;
	}

	function renderContent(_leftId: string, top: TopTab) {
		if (loading) return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
		if (error) return <p className="text-sm text-red-500 text-center py-12">{error}</p>;
		if (!data) return null;

		if (top === "Followers") return <ConnectionList items={data.followers} emptyLabel="Followers" />;
		if (top === "Following") return <ConnectionList items={data.following} emptyLabel="Following" />;

		// Membership tab
		if (entityType === "user") {
			const items = data.memberOf;
			if (!items.length) return <EmptyMessage label="Memberships" />;
			return (
				<div className="p-5 space-y-2">
					{items.map((item) => (
						<ProfileTag
							key={item.id}
							entity={item.page}
							badge={item.role.toLowerCase()}
							actions={<ViewLink href={PUBLIC_PROFILE(item.page.handle)} />}
						/>
					))}
				</div>
			);
		}

		// Page: members list
		const items = data.membership;
		const isAdmin = role === "ADMIN";
		if (!items.length) return <EmptyMessage label="Members" />;
		return (
			<div className="p-5 space-y-2">
				{items.map((item) => (
					<ProfileTag
						key={item.id}
						entity={item.user}
						badge={item.role.toLowerCase()}
						actions={
							isAdmin && item.user.id !== currentUserId ? (
								<MemberRowActions onRemove={removeMember(item.user.id)} />
							) : undefined
						}
					/>
				))}
			</div>
		);
	}

	return (
		<TabbedPanel<TopTab, string>
			topTabs={TOP_TABS}
			leftTabs={leftTabs}
			getCount={getCount}
			renderLeftTab={() => (
				<ProfileTag
					entity={entity}
					badge={isPage && role ? role.toLowerCase() : undefined}
					asLink={false}
					variant="compact"
					align="right"
					className="!border-0 !bg-transparent hover:!bg-transparent w-full"
				/>
			)}
			renderContent={renderContent}
			defaultLeft={entity.id}
		/>
	);
}
