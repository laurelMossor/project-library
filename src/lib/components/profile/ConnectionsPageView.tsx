"use client";

import { useState, useEffect } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/ui/TabbedPanel";
import { EntityAvatar } from "./EntityAvatar";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────

type TopTab = "Followers" | "Following" | "Membership";

type LeftTabId = string; // entity ID (user or page)

type LeftTabMeta = TabDef<LeftTabId> & {
	isSelf: boolean;
	entityType: "user" | "page";
	entityId: string;
	role?: string; // only set for page tabs
};

type ConnectionItem = {
	id: string;
	type: "USER" | "PAGE";
	followedAt: string;
	user: {
		id: string;
		username: string;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
		avatarImageId: string | null;
	} | null;
	page: {
		id: string;
		slug: string;
		name: string;
		avatarImageId: string | null;
	} | null;
};

// Used for page membership list (users who are members of a page)
type MemberItem = {
	id: string; // permission id
	role: string;
	user: {
		id: string;
		username: string;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
		avatarImageId: string | null;
	};
};

// Used for user membership list (pages the user is a member of)
type PageMembershipItem = {
	id: string; // permission id
	role: string;
	page: {
		id: string;
		slug: string;
		name: string;
		avatarImageId: string | null;
	};
};

type ConnectionsData = {
	followers: ConnectionItem[];
	following: ConnectionItem[];
	membership: MemberItem[];          // page entity: users who are members
	memberOf: PageMembershipItem[];    // user entity: pages user has a ROLE for the Page, e.g. Member, Admin, Editor. It will display a badge with the role 
};

// ─── Props ──────────────────────────────────────────────────────────────────

type PageEntity = {
	id: string;
	slug: string;
	name: string;
	avatarImageId: string | null;
	role: string; // user's permission role on this page
};

type UserEntity = {
	id: string;
	username: string;
	displayName: string | null;
	firstName: string | null;
	lastName: string | null;
	avatarImageId: string | null;
};

type ConnectionsPageViewProps = {
	user: UserEntity;
	pages: PageEntity[];
};

// ─── Constants ──────────────────────────────────────────────────────────────

const TOP_TABS: TabDef<TopTab>[] = [
	{ id: "Followers", label: "Followers" },
	{ id: "Following", label: "Following" },
	{ id: "Membership", label: "Membership" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function displayName(user: { displayName: string | null; firstName: string | null; lastName: string | null; username: string }) {
	return (
		user.displayName ||
		[user.firstName, user.lastName].filter(Boolean).join(" ") ||
		user.username
	);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ConnectionRow({ item }: { item: ConnectionItem }) {
	const isUser = item.type === "USER" && item.user;
	const isPage = item.type === "PAGE" && item.page;
	const href = isUser ? PUBLIC_USER_PAGE(item.user!.username) : isPage ? PUBLIC_PAGE(item.page!.slug) : "#";

	return (
		<div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors">
			<div className="flex items-center gap-3">
				{isUser && item.user ? (
					<EntityAvatar user={item.user} size="sm" asLink={false} />
				) : isPage && item.page ? (
					<EntityAvatar page={item.page} size="sm" asLink={false} />
				) : null}
				<div>
					{isUser && item.user && (
						<>
							<p className="text-sm font-medium text-rich-brown leading-tight">{displayName(item.user)}</p>
							<p className="text-xs text-dusty-grey">@{item.user.username}</p>
						</>
					)}
					{isPage && item.page && (
						<p className="text-sm font-medium text-rich-brown leading-tight">{item.page.name}</p>
					)}
				</div>
			</div>
			<Link href={href} className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors">
				View
			</Link>
		</div>
	);
}

function MemberRow({
	item,
	onRemove,
}: {
	item: MemberItem;
	onRemove?: (userId: string) => Promise<void>;
}) {
	const [removing, setRemoving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleRemove() {
		if (!onRemove) return;
		setRemoving(true);
		setError(null);
		try {
			await onRemove(item.user.id);
		} catch {
			setError("Failed to remove");
			setRemoving(false);
		}
	}

	return (
		<div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors">
			<div className="flex items-center gap-3">
				<EntityAvatar user={item.user} size="sm" asLink={false} />
				<div>
					<p className="text-sm font-medium text-rich-brown leading-tight">{displayName(item.user)}</p>
					<p className="text-xs text-dusty-grey">@{item.user.username}</p>
					{error && <p className="text-xs text-red-500">{error}</p>}
				</div>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey capitalize">
					{item.role.toLowerCase()}
				</span>
				{onRemove && (
					<button
						onClick={handleRemove}
						disabled={removing}
						className="text-xs px-3 py-1 rounded border border-soft-grey/60 text-dusty-grey hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer"
					>
						{removing ? "Removing..." : "Remove"}
					</button>
				)}
			</div>
		</div>
	);
}

function PageMembershipRow({ item }: { item: PageMembershipItem }) {
	return (
		<div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors">
			<div className="flex items-center gap-3">
				<EntityAvatar page={item.page} size="sm" asLink={false} />
				<p className="text-sm font-medium text-rich-brown leading-tight">{item.page.name}</p>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey capitalize">
					{item.role.toLowerCase()}
				</span>
				<Link
					href={PUBLIC_PAGE(item.page.slug)}
					className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors"
				>
					View
				</Link>
			</div>
		</div>
	);
}

function EmptyMessage({ label }: { label: string }) {
	return (
		<p className="text-sm text-dusty-grey text-center py-12">No {label.toLowerCase()} yet.</p>
	);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ConnectionsPageView({ user, pages }: ConnectionsPageViewProps) {
	const leftTabs: LeftTabMeta[] = [
		{ id: user.id, label: "Me", isSelf: true, entityType: "user", entityId: user.id },
		...pages.map((p) => ({
			id: p.id,
			label: p.name,
			isSelf: false,
			entityType: "page" as const,
			entityId: p.id,
			role: p.role,
		})),
	];

	const [data, setData] = useState<Record<string, ConnectionsData>>({});
	const [loading, setLoading] = useState(true);
	const [errorMap, setErrorMap] = useState<Record<string, string>>({});

	useEffect(() => {
		async function loadAll() {
			await Promise.all(
				leftTabs.map(async ({ entityId, entityType }) => {
					try {
						const base = entityType === "user" ? "users" : "pages";
						const [followersRes, followingRes, membershipRes] = await Promise.all([
							fetch(`/api/${base}/${entityId}/followers`),
							fetch(`/api/${base}/${entityId}/following`),
							entityType === "page"
								? fetch(`/api/pages/${entityId}/members`)
								: fetch(`/api/users/${entityId}/memberships`),
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

						setData((prev) => ({
							...prev,
							[entityId]: { followers, following, membership, memberOf },
						}));
					} catch {
						setErrorMap((prev) => ({ ...prev, [entityId]: "Failed to load connections" }));
					}
				})
			);
			setLoading(false);
		}

		loadAll();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function removeMember(pageId: string, userId: string): Promise<void> {
		const res = await fetch(`/api/pages/${pageId}/members/${userId}`, { method: "DELETE" });
		if (!res.ok) throw new Error(`Remove failed: ${res.status}`);
		setData((prev) => ({
			...prev,
			[pageId]: {
				...prev[pageId],
				membership: prev[pageId].membership.filter((m) => m.user.id !== userId),
			},
		}));
	}

	function getCount(leftId: LeftTabId, top: TopTab): number {
		const d = data[leftId];
		if (!d) return 0;
		if (top === "Followers") return d.followers.length;
		if (top === "Following") return d.following.length;
		const tab = leftTabs.find((t) => t.id === leftId)!;
		return tab.entityType === "user" ? d.memberOf.length : d.membership.length;
	}

	function renderContent(leftId: LeftTabId, top: TopTab) {
		const tab = leftTabs.find((t) => t.id === leftId)!;
		const d = data[leftId];
		const isLoading = loading && !d;
		const error = errorMap[leftId] ?? null;

		if (isLoading) {
			return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
		}
		if (error) {
			return <p className="text-sm text-red-500 text-center py-12">{error}</p>;
		}

		if (top === "Followers") {
			const items = d?.followers ?? [];
			if (!items.length) return <EmptyMessage label="Followers" />;
			return <div className="p-5 space-y-2">{items.map((item) => <ConnectionRow key={item.id} item={item} />)}</div>;
		}

		if (top === "Following") {
			const items = d?.following ?? [];
			if (!items.length) return <EmptyMessage label="Following" />;
			return <div className="p-5 space-y-2">{items.map((item) => <ConnectionRow key={item.id} item={item} />)}</div>;
		}

		// Membership tab
		if (tab.entityType === "user") {
			const items = d?.memberOf ?? [];
			if (!items.length) return <EmptyMessage label="Memberships" />;
			return <div className="p-5 space-y-2">{items.map((item) => <PageMembershipRow key={item.id} item={item} />)}</div>;
		}

		// Page membership — ADMIN can remove members, EDITOR is read-only
		const items = d?.membership ?? [];
		const isAdmin = tab.role === "ADMIN";
		if (!items.length) return <EmptyMessage label="Members" />;
		return (
			<div className="p-5 space-y-2">
				{items.map((item) => (
					<MemberRow
						key={item.id}
						item={item}
						onRemove={isAdmin && item.user.id !== user.id ? (userId) => removeMember(leftId, userId) : undefined}
					/>
				))}
			</div>
		);
	}

	return (
		<TabbedPanel<TopTab, LeftTabId>
			topTabs={TOP_TABS}
			leftTabs={leftTabs}
			getCount={getCount}
			renderLeftTab={(tab) => {
				const meta = tab as LeftTabMeta;
				return (
					<span className="flex flex-col items-end gap-0.5">
						<span>{meta.label}</span>
						{!meta.isSelf && meta.role && (
							<span className="text-[10px] font-normal opacity-50 tracking-wide uppercase">
								{meta.role.toLowerCase()}
							</span>
						)}
					</span>
				);
			}}
			renderContent={renderContent}
			defaultLeft={user.id}
		/>
	);
}
