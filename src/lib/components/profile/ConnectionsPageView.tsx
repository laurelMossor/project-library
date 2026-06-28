"use client";

import { useState, useEffect, ReactNode } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/layout/TabbedPanel";
import { ProfileTag } from "./ProfileTag";
import { ProfileSearchDropdown, SearchResultUser } from "@/lib/components/search/ProfileSearchDropdown";
import { DropdownMenu } from "@/lib/components/ui/DropdownMenu";
import { CardEntity, CardPageWithRole, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { EllipsisIcon, XCircleIcon } from "@/lib/components/icons/icons";
import {
	API_PAGE_REQUESTS,
	API_ME_REQUESTS,
	API_REQUEST_APPROVE,
	API_REQUEST_DENY,
} from "@/lib/const/routes";

// ─── Types ──────────────────────────────────────────────────────────────────

type TopTab = "Followers" | "Following" | "Membership" | "Requests";

type RequesterUser = {
	id: string;
	handle: string;
	displayName: string | null;
	avatarImageId: string | null;
};

type RequesterPage = {
	id: string;
	handle: string;
	name: string;
	avatarImageId: string | null;
};

type RequestItem = {
	id: string;
	kind: "FOLLOW" | "JOIN";
	requester: RequesterUser | null;
	requesterPage: RequesterPage | null;
};

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
	requests: RequestItem[];
};

// ─── Props ───────────────────────────────────────────────────────────────────

type ConnectionsPageViewProps = {
	entity: CardEntity;
	currentUserId: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

// ─── Sub-components ──────────────────────────────────────────────────────────

type ActionDef = {
	label: string;
	onAction: () => Promise<void>;
	/** Visual emphasis — "danger" (default) hints red on hover; "default" stays neutral. */
	tone?: "danger" | "default";
};

function ExpandableActions({
	expanded,
	onToggle,
	actions,
	extra,
}: {
	expanded: boolean;
	onToggle: () => void;
	actions: ActionDef[];
	/** Optional leading control revealed alongside the actions (e.g. a role selector). */
	extra?: ReactNode;
}) {
	const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function run(action: ActionDef) {
		setLoadingLabel(action.label);
		setError(null);
		try {
			await action.onAction();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong");
			setLoadingLabel(null);
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
			{extra}
			{actions.map((action) => {
				const danger = (action.tone ?? "danger") === "danger";
				return (
					<button
						key={action.label}
						onClick={() => run(action)}
						disabled={loadingLabel !== null}
						className={`text-xs px-3 py-1 rounded border border-soft-grey/60 text-dusty-grey transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap ${
							danger ? "hover:border-red-300 hover:text-red-500" : "hover:border-misty-forest hover:text-misty-forest"
						}`}
					>
						{loadingLabel === action.label ? "..." : action.label}
					</button>
				);
			})}
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

// Per-member role selector (ADMIN/EDITOR/MEMBER) using the shared DropdownMenu.
const ROLE_OPTIONS = ["ADMIN", "EDITOR", "MEMBER"] as const;

function RoleSelector({
	current,
	onChange,
}: {
	current: string;
	onChange: (role: string) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	return (
		<DropdownMenu
			isOpen={open}
			onClose={() => setOpen(!open)}
			triggerAriaLabel="Change role"
			triggerClassName="text-xs px-2 py-1 rounded border border-soft-grey/60 text-dusty-grey hover:border-misty-forest hover:text-misty-forest transition-colors cursor-pointer whitespace-nowrap"
			trigger={<span>{current.toLowerCase()} ▾</span>}
			containerClassName="min-w-[140px]"
		>
			{ROLE_OPTIONS.map((role) => (
				<button
					key={role}
					role="menuitem"
					onClick={async () => {
						setOpen(false);
						if (role !== current) await onChange(role);
					}}
					className={`w-full text-left px-4 py-1.5 text-sm hover:bg-soft-grey/20 transition-colors cursor-pointer ${
						role === current ? "font-semibold text-rich-brown" : "text-dusty-grey"
					}`}
				>
					{role.toLowerCase()}
				</button>
			))}
		</DropdownMenu>
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
									actions={[{ label: actionLabel, onAction: () => onAction(item) }]}
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
									actions={[{ label: actionLabel, onAction: () => onAction(item) }]}
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

				// Pending requests: page admins/editors see the page's; a user sees their
				// own incoming follow requests. Both endpoints gate, so a 401 → [].
				const requestsRes = await fetch(
					entityType === "page" ? API_PAGE_REQUESTS(entity.id) : API_ME_REQUESTS,
				);
				const requests: RequestItem[] = requestsRes.ok
					? (await requestsRes.json()).requests ?? []
					: [];

				setData({ followers, following, membership, memberOf, requests });
			} catch {
				setError("Failed to load connections");
			} finally {
				setLoading(false);
			}
		}
		load();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entity.id]);

	// TODO: These should be shared utilities, add if they don't already exist and use the existing one if it does. All instances of add/remove follower should share utilities. 
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

	async function changeMemberRole(item: MemberItem, role: string) {
		const res = await fetch(`/api/pages/${entity.id}/members/${item.user.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ role }),
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.error ?? "Failed to change role");
		}
		setData((prev) =>
			prev
				? { ...prev, membership: prev.membership.map((m) => (m.id === item.id ? { ...m, role } : m)) }
				: prev,
		);
	}

	async function actOnRequest(reqId: string, action: "approve" | "deny") {
		const res = await fetch(action === "approve" ? API_REQUEST_APPROVE(reqId) : API_REQUEST_DENY(reqId), {
			method: "POST",
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.error ?? `Failed to ${action} request`);
		}
		setData((prev) => (prev ? { ...prev, requests: prev.requests.filter((r) => r.id !== reqId) } : prev));
	}

	// Who may act on requests: page ADMIN/EDITOR, or a user on their own profile.
	const myRole = isPage && data ? data.membership.find((m) => m.user.id === currentUserId)?.role : undefined;
	const isAdmin = myRole === "ADMIN";
	const canManageRequests = isPage ? myRole === "ADMIN" || myRole === "EDITOR" : entity.id === currentUserId;

	const topTabs: TabDef<TopTab>[] = [
		{ id: "Followers", label: "Followers" },
		{ id: "Following", label: "Following" },
		{ id: "Membership", label: "Membership" },
		...(canManageRequests ? [{ id: "Requests" as const, label: "Requests" }] : []),
	];

	function getCount(_leftId: string, top: TopTab): number {
		if (!data) return 0;
		if (top === "Followers") return data.followers.length;
		if (top === "Following") return data.following.length;
		if (top === "Requests") return data.requests.length;
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

		if (top === "Requests") {
			const items = data.requests;
			if (!items.length) return <EmptyMessage label="Requests" />;
			return (
				<div className="p-5 space-y-2">
					{items.map((req) => {
						const requesterEntity = req.requesterPage ?? req.requester;
						if (!requesterEntity) return null;
						const badge = req.kind === "JOIN" ? "wants to join" : "wants to follow";
						const requestActions = (
							<ExpandableActions
								expanded={expandedId === req.id}
								onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
								actions={[
									{ label: "Approve", tone: "default", onAction: () => actOnRequest(req.id, "approve") },
									{ label: "Deny", onAction: () => actOnRequest(req.id, "deny") },
								]}
							/>
						);
						return req.requesterPage ? (
							<ProfileTag key={req.id} entity={req.requesterPage} badge={badge} actions={requestActions} />
						) : (
							<ProfileTag key={req.id} entity={req.requester!} badge={badge} actions={requestActions} />
						);
					})}
				</div>
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
									actions={[{
										label: "Leave Group",
										onAction: async () => {
											const res = await fetch(`/api/pages/${item.page.id}/membership`, {
												method: "DELETE",
											});
											if (!res.ok) {
												const body = await res.json().catch(() => ({}));
												throw new Error(body.error ?? "Failed to leave group");
											}
											setData((prev) =>
												prev
													? { ...prev, memberOf: prev.memberOf.filter((m) => m.id !== item.id) }
													: prev
											);
										},
									}]}
								/>
							}
						/>
					))}
				</div>
			);
		}

		// Membership tab — page profile. `isAdmin` is hoisted to component scope.
		const items = data.membership;

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
									extra={
										<RoleSelector
											current={item.role}
											onChange={(role) => changeMemberRole(item, role)}
										/>
									}
									actions={[{
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
									}]}
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
			topTabs={topTabs}
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
