"use client";

import { useState, useEffect } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/layout/TabbedPanel";
import { ProfileTag } from "./ProfileTag";
import { ProfileSearchDropdown, SearchResultUser } from "@/lib/components/search/ProfileSearchDropdown";
import { CardEntity, CardPageWithRole, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { EllipsisIcon, XCircleIcon } from "@/lib/components/icons/icons";

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

type ActionDef = {
	label: string;
	onAction: () => Promise<void>;
};

function ExpandableActions({
	expanded,
	onToggle,
	action,
}: {
	expanded: boolean;
	onToggle: () => void;
	action: ActionDef;
}) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleAction() {
		setLoading(true);
		setError(null);
		try {
			await action.onAction();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong");
			setLoading(false);
		}
	}

	if (!expanded) {
		return (
			<button
				onClick={onToggle}
				className="w-6 h-6 flex items-center justify-center text-dusty-grey hover:text-rich-brown transition-colors cursor-pointer"
				aria-label="More actions"
			>
				<EllipsisIcon className="w-4 h-4" />
			</button>
		);
	}

	return (
		<div className="flex items-center gap-1.5">
			{error && <p className="text-xs text-red-500 max-w-[160px] text-right leading-tight">{error}</p>}
			<button
				onClick={handleAction}
				disabled={loading}
				className="text-xs px-3 py-1 rounded border border-soft-grey/60 text-dusty-grey hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
			>
				{loading ? "..." : action.label}
			</button>
			<button
				onClick={onToggle}
				className="w-6 h-6 flex items-center justify-center text-dusty-grey hover:text-rich-brown transition-colors cursor-pointer"
				aria-label="Close"
			>
				<XCircleIcon className="w-4 h-4" />
			</button>
		</div>
	);
}

function EmptyMessage({ label }: { label: string }) {
	return <p className="text-sm text-dusty-grey text-center py-12">No {label.toLowerCase()} yet.</p>;
}

function ConnectionList({
	items,
	emptyLabel,
	expandedId,
	onToggle,
	actionLabel,
	onAction,
}: {
	items: ConnectionItem[];
	emptyLabel: string;
	expandedId: string | null;
	onToggle: (id: string | null) => void;
	actionLabel: string;
	onAction: (item: ConnectionItem) => Promise<void>;
}) {
	if (!items.length) return <EmptyMessage label={emptyLabel} />;
	return (
		<div className="p-5 space-y-2">
			{items.map((item) => {
				if (item.type === "USER" && item.user) {
					return (
						<ProfileTag
							key={item.id}
							entity={item.user}
							actions={
								<ExpandableActions
									expanded={expandedId === item.id}
									onToggle={() => onToggle(expandedId === item.id ? null : item.id)}
									action={{ label: actionLabel, onAction: () => onAction(item) }}
								/>
							}
						/>
					);
				}
				if (item.type === "PAGE" && item.page) {
					return (
						<ProfileTag
							key={item.id}
							entity={item.page}
							actions={
								<ExpandableActions
									expanded={expandedId === item.id}
									onToggle={() => onToggle(expandedId === item.id ? null : item.id)}
									action={{ label: actionLabel, onAction: () => onAction(item) }}
								/>
							}
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
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [showAddMember, setShowAddMember] = useState(false);

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

	async function removeFollower(item: ConnectionItem) {
		const type = isPage ? "page" : "user";
		const res = await fetch(
			`/api/follows/${entity.id}?type=${type}&removeFollower=${item.user!.id}`,
			{ method: "DELETE" }
		);
		if (!res.ok) throw new Error("Failed to remove follower");
		setData((prev) =>
			prev ? { ...prev, followers: prev.followers.filter((f) => f.id !== item.id) } : prev
		);
	}

	async function unfollow(item: ConnectionItem) {
		const type = item.type === "USER" ? "user" : "page";
		const targetId = item.type === "USER" ? item.user!.id : item.page!.id;
		const res = await fetch(`/api/follows/${targetId}?type=${type}`, { method: "DELETE" });
		if (!res.ok) throw new Error("Failed to unfollow");
		setData((prev) =>
			prev ? { ...prev, following: prev.following.filter((f) => f.id !== item.id) } : prev
		);
	}

	async function handleAddMember(user: SearchResultUser) {
		const res = await fetch(`/api/pages/${entity.id}/members`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId: user.id, role: "MEMBER" }),
		});
		if (!res.ok) return;
		const updated = await fetch(`/api/pages/${entity.id}/members`);
		if (updated.ok) {
			const members = await updated.json();
			setData((prev) => (prev ? { ...prev, membership: members } : prev));
		}
		setShowAddMember(false);
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

		if (top === "Followers") {
			return (
				<ConnectionList
					items={data.followers}
					emptyLabel="Followers"
					expandedId={expandedId}
					onToggle={setExpandedId}
					actionLabel="Remove Follower"
					onAction={removeFollower}
				/>
			);
		}

		if (top === "Following") {
			return (
				<ConnectionList
					items={data.following}
					emptyLabel="Following"
					expandedId={expandedId}
					onToggle={setExpandedId}
					actionLabel="Unfollow"
					onAction={unfollow}
				/>
			);
		}

		// Membership tab — user profile: pages the user is a member of
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
							actions={
								<ExpandableActions
									expanded={expandedId === item.id}
									onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
									action={{
										label: "Leave Group",
										onAction: async () => {
											const res = await fetch(`/api/pages/${item.page.id}/membership`, {
												method: "DELETE",
											});
											if (!res.ok) throw new Error("Failed to leave group");
											setData((prev) =>
												prev
													? { ...prev, memberOf: prev.memberOf.filter((m) => m.id !== item.id) }
													: prev
											);
										},
									}}
								/>
							}
						/>
					))}
				</div>
			);
		}

		// Membership tab — page profile
		// Derive admin status from the membership list rather than entity.role,
		// since GET /api/me/page doesn't include the user's role in its response.
		const items = data.membership;
		const isAdmin = data.membership.find((m) => m.user.id === currentUserId)?.role === "ADMIN";

		return (
			<div className="p-5 space-y-2">
				{!items.length && <EmptyMessage label="Members" />}
				{items.map((item) => (
					<ProfileTag
						key={item.id}
						entity={item.user}
						badge={item.role.toLowerCase()}
						actions={
							isAdmin && item.user.id !== currentUserId ? (
								<ExpandableActions
									expanded={expandedId === item.id}
									onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
									action={{
										label: "Remove from group",
										onAction: async () => {
											const res = await fetch(
												`/api/pages/${entity.id}/members/${item.user.id}`,
												{ method: "DELETE" }
											);
											if (!res.ok) {
												const body = await res.json().catch(() => ({}));
												throw new Error(body.error ?? "Failed to remove member");
											}
											setData((prev) =>
												prev
													? {
															...prev,
															membership: prev.membership.filter((m) => m.id !== item.id),
														}
													: prev
											);
										},
									}}
								/>
							) : undefined
						}
					/>
				))}
				{isAdmin && (
					<div className="pt-3">
						{showAddMember ? (
							<div className="space-y-2">
								<ProfileSearchDropdown
									excludeUserIds={data.membership.map((m) => m.user.id)}
									onSelect={handleAddMember}
									placeholder="Search by name or handle..."
								/>
								<div className="flex justify-center">
									<button
										onClick={() => setShowAddMember(false)}
										className="text-xs text-dusty-grey hover:text-rich-brown transition-colors cursor-pointer"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<div className="flex justify-center">
								<button
									onClick={() => setShowAddMember(true)}
									className="text-xs px-4 py-1.5 rounded border border-soft-grey/60 text-dusty-grey hover:border-misty-forest hover:text-misty-forest transition-colors cursor-pointer"
								>
									+ Add members
								</button>
							</div>
						)}
					</div>
				)}
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
