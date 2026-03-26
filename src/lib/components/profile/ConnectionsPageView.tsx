"use client";

import { useState, useEffect } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/ui/TabbedPanel";
import { EntityAvatar } from "./EntityAvatar";
import { PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────

type TopTab = "Followers" | "Following" | "Admins";

type LeftTabId = string; // entity ID (user or page)

type LeftTabMeta = TabDef<LeftTabId> & {
	isSelf: boolean;
	entityType: "user" | "page";
	entityId: string;
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

type AdminItem = {
	id: string;
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

type ConnectionsData = {
	followers: ConnectionItem[];
	following: ConnectionItem[];
	admins: AdminItem[];
};

// ─── Props ──────────────────────────────────────────────────────────────────

type PageEntity = {
	id: string;
	slug: string;
	name: string;
	avatarImageId: string | null;
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
	{ id: "Admins", label: "Admins" },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function ConnectionRow({ item }: { item: ConnectionItem }) {
	const isUser = item.type === "USER" && item.user;
	const isPage = item.type === "PAGE" && item.page;

	const href = isUser
		? PUBLIC_USER_PAGE(item.user!.username)
		: isPage
		? PUBLIC_PAGE(item.page!.slug)
		: "#";

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
							<p className="text-sm font-medium text-rich-brown leading-tight">
								{item.user.displayName ||
									[item.user.firstName, item.user.lastName].filter(Boolean).join(" ") ||
									item.user.username}
							</p>
							<p className="text-xs text-dusty-grey">@{item.user.username}</p>
						</>
					)}
					{isPage && item.page && (
						<p className="text-sm font-medium text-rich-brown leading-tight">{item.page.name}</p>
					)}
				</div>
			</div>
			<Link
				href={href}
				className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors"
			>
				View
			</Link>
		</div>
	);
}

function AdminRow({ item }: { item: AdminItem }) {
	return (
		<div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors">
			<div className="flex items-center gap-3">
				<EntityAvatar user={item.user} size="sm" asLink={false} />
				<div>
					<p className="text-sm font-medium text-rich-brown leading-tight">
						{item.user.displayName ||
							[item.user.firstName, item.user.lastName].filter(Boolean).join(" ") ||
							item.user.username}
					</p>
					<p className="text-xs text-dusty-grey">@{item.user.username}</p>
				</div>
			</div>
			<span className="text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey capitalize">
				{item.role.toLowerCase()}
			</span>
		</div>
	);
}

function ConnectionList({
	items,
	loading,
	error,
	label,
}: {
	items: ConnectionItem[] | AdminItem[];
	loading: boolean;
	error: string | null;
	label: string;
}) {
	if (loading) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}
	if (error) {
		return <p className="text-sm text-red-500 text-center py-12">{error}</p>;
	}
	if (items.length === 0) {
		return (
			<p className="text-sm text-dusty-grey text-center py-12">
				No {label.toLowerCase()} yet.
			</p>
		);
	}
	return (
		<div className="p-5 space-y-2">
			{(items as (ConnectionItem | AdminItem)[]).map((item) =>
				"followedAt" in item ? (
					<ConnectionRow key={item.id} item={item as ConnectionItem} />
				) : (
					<AdminRow key={item.id} item={item as AdminItem} />
				)
			)}
		</div>
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
		})),
	];

	// data[entityId] = { followers, following, admins }
	const [data, setData] = useState<Record<string, ConnectionsData>>({});
	const [loading, setLoading] = useState(true);
	const [errorMap, setErrorMap] = useState<Record<string, string>>({});

	// Load all entities on mount
	useEffect(() => {
		async function loadAll() {
			await Promise.all(
				leftTabs.map(async ({ entityId, entityType }) => {
					try {
						const base = entityType === "user" ? "users" : "pages";
						const [followersRes, followingRes, adminsRes] = await Promise.all([
							fetch(`/api/${base}/${entityId}/followers`),
							fetch(`/api/${base}/${entityId}/following`),
							entityType === "page"
								? fetch(`/api/pages/${entityId}/members`)
								: Promise.resolve(null),
						]);

						const followers = followersRes.ok
							? (await followersRes.json()).followers ?? []
							: [];
						const following = followingRes.ok
							? (await followingRes.json()).following ?? []
							: [];
						const admins =
							entityType === "page" && adminsRes?.ok
								? ((await adminsRes.json()) as AdminItem[])
								: [];

						setData((prev) => ({
							...prev,
							[entityId]: { followers, following, admins },
						}));
					} catch {
						setErrorMap((prev) => ({
							...prev,
							[entityId]: "Failed to load connections",
						}));
					}
				})
			);
			setLoading(false);
		}

		loadAll();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function getCount(leftId: LeftTabId, top: TopTab): number {
		const d = data[leftId];
		if (!d) return 0;
		if (top === "Followers") return d.followers.length;
		if (top === "Following") return d.following.length;
		return d.admins.length;
	}

	function renderContent(leftId: LeftTabId, top: TopTab) {
		const tab = leftTabs.find((t) => t.id === leftId)!;
		const d = data[leftId];
		const error = errorMap[leftId] ?? null;

		const items: ConnectionItem[] | AdminItem[] =
			!d
				? []
				: top === "Followers"
				? d.followers
				: top === "Following"
				? d.following
				: d.admins;

		// Admins tab on user entity: users don't have admins
		if (top === "Admins" && tab.entityType === "user") {
			return (
				<p className="text-sm text-dusty-grey text-center py-12">No admins yet.</p>
			);
		}

		return (
			<ConnectionList
				items={items}
				loading={loading && !d}
				error={error}
				label={top}
			/>
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
						{!meta.isSelf && (
							<span className="text-[10px] font-normal opacity-50 tracking-wide uppercase">
								admin
							</span>
						)}
					</span>
				);
			}}
			renderContent={renderContent}
			// Load data when a new left tab is activated
			defaultLeft={user.id}
		/>
	);
}
