"use client";

import { useState, useEffect } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/ui/TabbedPanel";
import { ProfileTag } from "./ProfileTag";
import { getCardUserDisplayName } from "@/lib/types/card";
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
	entity: UserEntity | PageEntity;
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
	avatarImage?: { url: string } | null;
	role: string; // user's permission role on this page
};

type UserEntity = {
	id: string;
	username: string;
	displayName: string | null;
	firstName: string | null;
	lastName: string | null;
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
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

// ─── MemberRowActions — file-scope component to keep hooks valid ─────────────

function MemberRowActions({
	onRemove,
}: {
	onRemove: () => Promise<void>;
}) {
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
	return (
		<p className="text-sm text-dusty-grey text-center py-12">No {label.toLowerCase()} yet.</p>
	);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ConnectionsPageView({ user, pages }: ConnectionsPageViewProps) {
	const leftTabs: LeftTabMeta[] = [
		{ id: user.id, label: getCardUserDisplayName(user), isSelf: true, entityType: "user", entityId: user.id, entity: user },
		...pages.map((p) => ({
			id: p.id,
			label: p.name,
			isSelf: false,
			entityType: "page" as const,
			entityId: p.id,
			role: p.role,
			entity: p,
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
			return (
				<div className="p-5 space-y-2">
					{items.map((item) => {
						const isUser = item.type === "USER" && item.user;
						const isPage = item.type === "PAGE" && item.page;
						const href = isUser ? PUBLIC_USER_PAGE(item.user!.username) : isPage ? PUBLIC_PAGE(item.page!.slug) : "#";
						const viewLink = <Link href={href} className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors">View</Link>;
						if (isUser && item.user) return <ProfileTag key={item.id} entity={item.user} actions={viewLink} />;
						if (isPage && item.page) return <ProfileTag key={item.id} entity={item.page} actions={viewLink} />;
						return null;
					})}
				</div>
			);
		}

		if (top === "Following") {
			const items = d?.following ?? [];
			if (!items.length) return <EmptyMessage label="Following" />;
			return (
				<div className="p-5 space-y-2">
					{items.map((item) => {
						const isUser = item.type === "USER" && item.user;
						const isPage = item.type === "PAGE" && item.page;
						const href = isUser ? PUBLIC_USER_PAGE(item.user!.username) : isPage ? PUBLIC_PAGE(item.page!.slug) : "#";
						const viewLink = <Link href={href} className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors">View</Link>;
						if (isUser && item.user) return <ProfileTag key={item.id} entity={item.user} actions={viewLink} />;
						if (isPage && item.page) return <ProfileTag key={item.id} entity={item.page} actions={viewLink} />;
						return null;
					})}
				</div>
			);
		}

		// Membership tab
		if (tab.entityType === "user") {
			const items = d?.memberOf ?? [];
			if (!items.length) return <EmptyMessage label="Memberships" />;
			return (
				<div className="p-5 space-y-2">
					{items.map((item) => (
						<ProfileTag
							key={item.id}
							entity={item.page}
							badge={item.role.toLowerCase()}
							actions={
								<Link
									href={PUBLIC_PAGE(item.page.slug)}
									className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors"
								>
									View
								</Link>
							}
						/>
					))}
				</div>
			);
		}

		// Page membership — ADMIN can remove members, EDITOR is read-only
		const items = d?.membership ?? [];
		const isAdmin = tab.role === "ADMIN";
		if (!items.length) return <EmptyMessage label="Members" />;
		return (
			<div className="p-5 space-y-2">
				{items.map((item) => (
					<ProfileTag
						key={item.id}
						entity={item.user}
						badge={item.role.toLowerCase()}
						actions={
							isAdmin && item.user.id !== user.id ? (
								<MemberRowActions onRemove={() => removeMember(leftId, item.user.id)} />
							) : undefined
						}
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
					<ProfileTag
						entity={meta.entity}
						badge={!meta.isSelf && meta.role ? meta.role.toLowerCase() : undefined}
						asLink={false}
						variant="compact"
						align="right"
						className="!border-0 !bg-transparent hover:!bg-transparent w-full"
					/>
				);
			}}
			renderContent={renderContent}
			defaultLeft={user.id}
		/>
	);
}
