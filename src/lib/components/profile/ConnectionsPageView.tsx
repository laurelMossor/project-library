"use client";

import { useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/layout/TabbedPanel";
import { ProfileTag } from "./ProfileTag";
import { RoleSelector } from "./RoleSelector";
import { EmailInviteTag } from "./EmailInviteTag";
import { EmailInviteModal } from "./EmailInviteModal";
import { ProfileSearchDropdown, SearchResultUser } from "@/lib/components/search/ProfileSearchDropdown";
import { CardEntity, CardPageWithRole, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import { EllipsisIcon, XCircleIcon } from "@/lib/components/icons/icons";
import {
	API_PAGE,
	API_PAGE_REQUESTS,
	API_PAGE_MEMBERS,
	API_PAGE_MEMBER,
	API_PAGE_EMAIL_INVITE,
	API_PAGE_MEMBERSHIP,
	API_ME_REQUESTS,
	API_ME_INVITES,
	API_REQUEST_APPROVE,
	API_REQUEST_DENY,
} from "@/lib/const/routes";
import { assignableRoles, formatRole, isAdminRole } from "@/lib/const/roles";
import type { PermissionRole } from "@prisma/client";

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
	/** True for an invitation that hasn't been accepted. The row's id is the request id. */
	pending?: boolean;
	user: {
		id: string;
		handle: string;
		displayName: string | null;
		avatarImageId: string | null;
	};
};

/** A page's pending invite sent by email: shown by address only (never a profile). */
type EmailInviteItem = {
	id: string;
	kind: "email";
	email: string;
	role: string;
};

type InviteItem = {
	id: string;
	role: string | null;
	/** The inviting admin's optional note. */
	note?: string | null;
	page: {
		id: string;
		handle: string;
		name: string;
		avatarImageId: string | null;
	} | null;
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
	/** Page only, admin only: pending invites sent by email. */
	emailInvites: EmailInviteItem[];
	memberOf: PageMembershipItem[];
	requests: RequestItem[];
	invites: InviteItem[];
};

/** GET members returns members, profile invites, and email invites in one list — split them. */
function splitMemberRows(rows: (MemberItem | EmailInviteItem)[]) {
	const isEmail = (r: MemberItem | EmailInviteItem): r is EmailInviteItem => "kind" in r && r.kind === "email";
	return {
		membership: rows.filter((r): r is MemberItem => !isEmail(r)),
		emailInvites: rows.filter(isEmail),
	};
}

// ─── Props ───────────────────────────────────────────────────────────────────

type ConnectionsPageViewProps = {
	entity: CardEntity;
	currentUserId: string;
	/** Tab to open on load (e.g. from a `?tab=Requests` notification deep-link). Ignored if not a visible tab. */
	initialTab?: string;
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
				className="w-6 h-6 flex items-center justify-center text-dusty-grey hover:text-rich-brown transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-brown/20 rounded"
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
						className={`text-xs px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-brown/20 ${
							danger
								? "bg-white border border-red-300 text-red-600 hover:bg-red-50"
								: "bg-moss-green text-white hover:opacity-90"
						}`}
					>
						{loadingLabel === action.label ? "..." : action.label}
					</button>
				);
			})}
			<button
				onClick={onToggle}
				className="w-6 h-6 flex items-center justify-center text-dusty-grey hover:text-rich-brown transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-brown/20 rounded"
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

export function ConnectionsPageView({ entity, currentUserId, initialTab }: ConnectionsPageViewProps) {
	const isPage = isCardPage(entity);
	const entityType = isPage ? "page" : "user";
	const role = isPage ? (entity as CardPageWithRole).role : undefined;
	const displayName = isPage ? entity.name : getCardUserDisplayName(entity);

	const leftTabs: TabDef<string>[] = [{ id: entity.id, label: displayName }];

	const [data, setData] = useState<ConnectionsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// Active top tab. Left `undefined` so TabbedPanel stays uncontrolled (defaults to Followers)
	// until either the user clicks a tab or the deep-link latch below resolves it.
	const [activeTop, setActiveTop] = useState<TopTab | undefined>(undefined);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [showAddMember, setShowAddMember] = useState(false);
	const [addMemberError, setAddMemberError] = useState<string | null>(null);
	// Explicit-pick add flow: hold the selected user + chosen role until confirmed,
	// rather than granting MEMBER immediately on select.
	const [pendingUser, setPendingUser] = useState<SearchResultUser | null>(null);
	const [pendingRole, setPendingRole] = useState<PermissionRole>("EDITOR");
	const [pagePolicy, setPagePolicy] = useState<string>("CLOSED");
	// Invite-via-email modal: null = closed, else the address field's prefill.
	const [emailInvitePrefill, setEmailInvitePrefill] = useState<string | null>(null);
	const [inviteNotice, setInviteNotice] = useState<string | null>(null);
	const roleChoices = assignableRoles(pagePolicy);

	// Load every connections slice in one pass. `silent` skips the loading/error toggles so a
	// post-mutation refresh doesn't flash the panel's "Loading…" state or wipe it on a transient
	// failure — it just swaps in fresh data. Used both for the initial mount and to reconcile
	// cross-slice effects (e.g. approving a request materializes a follower/member the narrow
	// optimistic update can't see).
	const loadConnections = useCallback(
		async (opts?: { silent?: boolean }) => {
			const silent = opts?.silent ?? false;
			if (!silent) {
				setLoading(true);
				setError(null);
			}
			try {
				const base = entityType === "user" ? "users" : "pages";
				const [followersRes, followingRes, membershipRes, invitesRes, pageRes] = await Promise.all([
					fetch(`/api/${base}/${entity.id}/followers`),
					fetch(`/api/${base}/${entity.id}/following`),
					entityType === "page"
						? fetch(API_PAGE_MEMBERS(entity.id))
						: fetch(`/api/users/${entity.id}/memberships`),
					entityType === "user" ? fetch(API_ME_INVITES) : Promise.resolve(null),
					entityType === "page" ? fetch(API_PAGE(entity.id)) : Promise.resolve(null),
				]);

				const followers = followersRes.ok ? (await followersRes.json()).followers ?? [] : [];
				const following = followingRes.ok ? (await followingRes.json()).following ?? [] : [];
				let membership: MemberItem[] = [];
				let emailInvites: EmailInviteItem[] = [];
				let memberOf: PageMembershipItem[] = [];

				if (entityType === "page" && membershipRes.ok) {
					({ membership, emailInvites } = splitMemberRows(await membershipRes.json()));
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

				const invites: InviteItem[] = invitesRes?.ok
					? (await invitesRes.json()).invites ?? []
					: [];

				if (pageRes?.ok) {
					const page = await pageRes.json();
					if (typeof page.membershipPolicy === "string") setPagePolicy(page.membershipPolicy);
				}

				setData({ followers, following, membership, emailInvites, memberOf, requests, invites });
			} catch {
				// Keep the already-loaded panel intact on a silent refresh failure; only the
				// initial load surfaces the error.
				if (!silent) setError("Failed to load connections");
			} finally {
				if (!silent) setLoading(false);
			}
		},
		[entity.id, entityType],
	);

	// Initial load (shows the loading state); re-runs if the viewed entity changes.
	useEffect(() => {
		loadConnections();
	}, [loadConnections]);

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

	// ProfileSearchDropdown's onSelect is fire-and-forget: just capture the picked user
	// and default the role; the admin confirms an explicit role before we POST. (Adding
	// a person is now a real ADMIN/EDITOR grant, so it must be a deliberate choice.)
	function selectPendingUser(user: SearchResultUser) {
		setAddMemberError(null);
		setPendingRole(roleChoices[roleChoices.length - 1]);
		setPendingUser(user);
	}

	function cancelAddMember() {
		setShowAddMember(false);
		setPendingUser(null);
		setAddMemberError(null);
	}

	async function refreshMembers() {
		const updated = await fetch(API_PAGE_MEMBERS(entity.id));
		if (updated.ok) {
			const split = splitMemberRows(await updated.json());
			setData((prev) => (prev ? { ...prev, ...split } : prev));
		}
	}

	function openEmailInvite(query: string) {
		setAddMemberError(null);
		setInviteNotice(null);
		// Carry over an address typed into the search; anything else isn't worth prefilling.
		setEmailInvitePrefill(query.includes("@") ? query : "");
	}

	async function onEmailInvitesSent(result: { sent: number; alreadyMembers: string[] }) {
		setEmailInvitePrefill(null);
		setShowAddMember(false);
		const parts: string[] = [];
		if (result.sent > 0) {
			parts.push(`Invites sent to ${result.sent} ${result.sent === 1 ? "address" : "addresses"}.`);
		}
		if (result.alreadyMembers.length === 1) {
			parts.push(`${result.alreadyMembers[0]} already has a role on this page.`);
		} else if (result.alreadyMembers.length > 1) {
			parts.push(`${result.alreadyMembers.join(", ")} already have a role on this page.`);
		}
		setInviteNotice(parts.join(" "));
		await refreshMembers();
	}

	async function confirmAddMember() {
		if (!pendingUser) return;
		setAddMemberError(null);
		try {
			const res = await fetch(API_PAGE_MEMBERS(entity.id), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: pendingUser.id, role: pendingRole }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error ?? "Failed to add member");
			}
			await refreshMembers();
			setShowAddMember(false);
			setPendingUser(null);
		} catch (e) {
			setAddMemberError(e instanceof Error ? e.message : "Failed to add member");
		}
	}

	async function changeInviteRole(item: MemberItem, role: string) {
		const res = await fetch(API_PAGE_MEMBERS(entity.id), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId: item.user.id, role }),
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.error ?? "Failed to change invite role");
		}
		setData((prev) =>
			prev
				? { ...prev, membership: prev.membership.map((m) => (m.id === item.id ? { ...m, role } : m)) }
				: prev,
		);
	}

	async function changeMemberRole(item: MemberItem, role: string) {
		const res = await fetch(API_PAGE_MEMBER(entity.id, item.user.id), {
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
		if (action === "approve") {
			// Approving materializes a Follow (→ followers) or Permission (→ membership) in a
			// slice this handler doesn't own, so a narrow filter would leave those counts/lists
			// stale until reload. Refresh every slice silently instead.
			await loadConnections({ silent: true });
		} else {
			// Denying only drops the pending row — no cross-slice effect, so stay optimistic.
			setData((prev) => (prev ? { ...prev, requests: prev.requests.filter((r) => r.id !== reqId) } : prev));
		}
	}

	// Who may act on requests: a page ADMIN, or a user on their own profile.
	// Page requests are ADMIN-only (matching member management), so this mirrors
	// the server gate — an EDITOR sees no Requests tab.
	const myRole = isPage && data ? data.membership.find((m) => m.user.id === currentUserId)?.role : undefined;
	const isAdmin = isAdminRole(myRole);
	const canManageRequests = isPage ? isAdmin : entity.id === currentUserId;

	// Memoized so its identity only changes when the Requests tab appears/disappears — the
	// deep-link latch effect below depends on it and shouldn't re-run every render.
	const topTabs: TabDef<TopTab>[] = useMemo(
		() => [
			{ id: "Followers", label: "Followers" },
			{ id: "Following", label: "Following" },
			{ id: "Membership", label: "Membership" },
			...(canManageRequests ? [{ id: "Requests" as const, label: "Requests" }] : []),
		],
		[canManageRequests],
	);

	// Honor a deep-link tab (?tab=Requests) once it's an actually-visible tab for this viewer.
	// For a page, the Requests tab only appears after membership loads and admin status is known,
	// so applying the deep-link at mount would lose it (the tab defaults to Followers before
	// Requests exists). Apply it in an effect, latched once so it never fights a later manual
	// tab click.
	const appliedInitialTabRef = useRef(false);
	useEffect(() => {
		if (appliedInitialTabRef.current) return;
		if (!initialTab) {
			appliedInitialTabRef.current = true;
			return;
		}
		if (topTabs.some((t) => t.id === initialTab)) {
			setActiveTop(initialTab as TopTab);
			appliedInitialTabRef.current = true;
		}
	}, [initialTab, topTabs]);

	function getCount(_leftId: string, top: TopTab): number {
		if (!data) return 0;
		if (top === "Followers") return data.followers.length;
		if (top === "Following") return data.following.length;
		if (top === "Requests") return data.requests.length;
		return entityType === "user"
			? data.memberOf.length + data.invites.length
			: data.membership.length + data.emailInvites.length;
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
			const invites = data.invites.filter((inv) => inv.page);
			if (!items.length && !invites.length) return <EmptyMessage label="Memberships" />;
			return (
				<div className="p-5 space-y-2">
					{invites.length > 0 && (
						<p className="text-xs font-medium text-dusty-grey pt-1">Pending invitations</p>
					)}
					{invites.map((inv) => (
						<div key={inv.id} className="space-y-1">
							<ProfileTag
								entity={inv.page!}
								badge={`Pending · invited as ${formatRole(inv.role)}`}
								actions={
									<ExpandableActions
										expanded={expandedId === inv.id}
										onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
										actions={[
											{ label: "Accept", tone: "default", onAction: () => actOnRequest(inv.id, "approve") },
											{
												label: "Decline",
												onAction: async () => {
													await actOnRequest(inv.id, "deny");
													setData((prev) =>
														prev ? { ...prev, invites: prev.invites.filter((i) => i.id !== inv.id) } : prev,
													);
												},
											},
										]}
									/>
								}
							/>
							{inv.note && (
								<p className="px-3 text-xs text-dusty-grey whitespace-pre-wrap">
									&ldquo;{inv.note}&rdquo;
								</p>
							)}
						</div>
					))}
					{items.map((item) => (
						<ProfileTag
							key={item.id}
							entity={item.page}
							badge={formatRole(item.role)}
							actions={
								<ExpandableActions
									expanded={expandedId === item.id}
									onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
									actions={[{
										label: "Leave",
										onAction: async () => {
											const res = await fetch(API_PAGE_MEMBERSHIP(item.page.id), {
												method: "DELETE",
											});
											if (!res.ok) {
												const body = await res.json().catch(() => ({}));
												throw new Error(body.error ?? "Failed to leave");
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
		const emailInvites = data.emailInvites;

		return (
			<div className="p-5 space-y-2">
				{!items.length && !emailInvites.length && <EmptyMessage label="Members" />}
				{items.map((item) => {
					if (item.pending) {
						const canChange = isAdmin;
						return (
							<ProfileTag
								key={item.id}
								entity={item.user}
								badge={canChange ? (
									<span className="inline-flex items-center gap-1.5">
										<span className="text-xs text-dusty-grey">Pending</span>
										<RoleSelector
											current={item.role}
											roles={roleChoices}
											onChange={(role) => changeInviteRole(item, role)}
										/>
									</span>
								) : `Pending · invited as ${formatRole(item.role)}`}
								actions={
									isAdmin ? (
										<ExpandableActions
											expanded={expandedId === item.id}
											onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
											actions={[{
												label: "Cancel",
												onAction: async () => {
													const res = await fetch(API_REQUEST_DENY(item.id), { method: "POST" });
													if (!res.ok) {
														const body = await res.json().catch(() => ({}));
														throw new Error(body.error ?? "Failed to cancel invite");
													}
													setData((prev) =>
														prev
															? { ...prev, membership: prev.membership.filter((m) => m.id !== item.id) }
															: prev,
													);
												},
											}]}
										/>
									) : undefined
								}
							/>
						);
					}
					return (
					<ProfileTag
						key={item.id}
						entity={item.user}
						badge={
							isAdmin && item.user.id !== currentUserId ? (
								<RoleSelector
									current={item.role}
									roles={roleChoices}
									onChange={(role) => changeMemberRole(item, role)}
								/>
							) : formatRole(item.role)
						}
						actions={
							isAdmin && item.user.id !== currentUserId ? (
								<ExpandableActions
									expanded={expandedId === item.id}
									onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
									actions={[{
										label: "Remove from group",
										onAction: async () => {
											const res = await fetch(API_PAGE_MEMBER(entity.id, item.user.id), { method: "DELETE" });
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
					);
				})}
				{/* Sent by email: listed by address until accepted, never by profile (admin-only rows). */}
				{emailInvites.map((inv) => (
					<EmailInviteTag
						key={inv.id}
						email={inv.email}
						badge={`Pending · invited as ${formatRole(inv.role)}`}
						actions={
							<ExpandableActions
								expanded={expandedId === inv.id}
								onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
								actions={[{
									label: "Cancel",
									onAction: async () => {
										const res = await fetch(API_PAGE_EMAIL_INVITE(entity.id, inv.id), { method: "DELETE" });
										if (!res.ok) {
											const body = await res.json().catch(() => ({}));
											throw new Error(body.error ?? "Failed to cancel invite");
										}
										setData((prev) =>
											prev
												? { ...prev, emailInvites: prev.emailInvites.filter((e) => e.id !== inv.id) }
												: prev,
										);
									},
								}]}
							/>
						}
					/>
				))}
				{isAdmin && (
					<div className="pt-3">
						{showAddMember ? (
							<div className="space-y-2">
								{pendingUser ? (
									// Step 2: an explicit role pick before granting (no silent MEMBER default).
									<ProfileTag
										entity={pendingUser}
										actions={
											<div className="flex items-center gap-1.5">
												<RoleSelector
													current={pendingRole}
													roles={roleChoices}
													onChange={async (role) => setPendingRole(role as PermissionRole)}
												/>
												<button
													onClick={confirmAddMember}
													className="text-xs px-3 py-1 rounded-md font-medium bg-moss-green text-white hover:opacity-90 transition-colors cursor-pointer whitespace-nowrap"
												>
													Invite
												</button>
												<button
													onClick={() => setPendingUser(null)}
													className="text-xs px-3 py-1 rounded-md font-medium bg-white border border-red-300 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
												>
													Cancel
												</button>
											</div>
										}
									/>
								) : (
									// Step 1: pick a person.
									<ProfileSearchDropdown
										excludeUserIds={data.membership.map((m) => m.user.id)}
										onSelect={selectPendingUser}
										placeholder="Search by name or handle..."
										extraOption={{ label: "Invite via email", onSelect: openEmailInvite }}
									/>
								)}
								{addMemberError && (
									<p className="text-xs text-red-500 text-center">{addMemberError}</p>
								)}
								<div className="flex justify-center">
									<button
										onClick={cancelAddMember}
										className="text-xs text-dusty-grey hover:text-rich-brown transition-colors cursor-pointer"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-center gap-2">
								{inviteNotice && <p role="status" className="text-xs text-misty-forest">{inviteNotice}</p>}
								<button
									onClick={() => {
										setInviteNotice(null);
										setShowAddMember(true);
									}}
									className="text-xs px-4 py-1.5 rounded border border-soft-grey/60 text-dusty-grey hover:border-misty-forest hover:text-misty-forest transition-colors cursor-pointer"
								>
									Invite
								</button>
							</div>
						)}
						{emailInvitePrefill !== null && isPage && (
							<EmailInviteModal
								pageId={entity.id}
								pageName={entity.name}
								roleChoices={roleChoices}
								initialEmails={emailInvitePrefill}
								onClose={() => setEmailInvitePrefill(null)}
								onSent={onEmailInvitesSent}
							/>
						)}
					</div>
				)}
			</div>
		);
	}

	return (
		<TabbedPanel<TopTab, string>
			topTabs={topTabs}
			activeTop={activeTop}
			onActiveTopChange={setActiveTop}
			leftTabs={leftTabs}
			getCount={getCount}
			renderLeftTab={() => (
				<ProfileTag
					entity={entity}
					badge={isPage && role ? formatRole(role) : undefined}
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
