"use client";

import { useState } from "react";
import { TabbedPanel, TabDef } from "@/lib/components/layout/TabbedPanel";
import { ProfileTag } from "./ProfileTag";
import { RoleSelector } from "./RoleSelector";
import { EmailInviteTag } from "./EmailInviteTag";
import { EmailInviteModal } from "./EmailInviteModal";
import { ProfileSearchDropdown, SearchResultUser } from "@/lib/components/search/ProfileSearchDropdown";
import { CardEntity, CardPageWithRole, isCardPage, getCardUserDisplayName } from "@/lib/types/card";
import type { ConnectionItem, ConnectionsData } from "@/lib/types/connections";
import type { ActionResult } from "@/lib/types/action";
import { EllipsisIcon, XCircleIcon } from "@/lib/components/icons/icons";
import { assignableRoles, formatRole, isAdminRole } from "@/lib/const/roles";
import { useAction } from "@/lib/hooks/useAction";
import { removeFollowerAction, setFollow } from "@/lib/actions/follow";
import {
	approveRequestAction,
	cancelEmailInviteAction,
	changeMemberRoleAction,
	denyRequestAction,
	inviteMemberAction,
	leavePageAction,
	removeMemberAction,
} from "@/lib/actions/membership";
import type { PermissionRole } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

type TopTab = "Followers" | "Following" | "Membership" | "Requests";

// ─── Props ───────────────────────────────────────────────────────────────────

type ConnectionsPageViewProps = {
	entity: CardEntity;
	currentUserId: string;
	/** Everything the tabs list, read on the server. A saved action refreshes it. */
	data: ConnectionsData;
	/** Tab to open on load (e.g. from a `?tab=Requests` notification deep-link). Ignored if not a visible tab. */
	initialTab?: string;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/** A save to run through `useAction`: the row's buttons and the role chips hand over a ready-to-call action. */
type Perform = () => Promise<ActionResult<unknown>>;

/** `useAction` runs a one-argument action; here the argument is the action to run. */
const invoke = (perform: Perform) => perform();

type ActionDef = {
	label: string;
	perform: Perform;
	/** Visual emphasis — "danger" (default) hints red on hover; "default" stays neutral. */
	tone?: "danger" | "default";
};

function ExpandableActions({
	expanded,
	onToggle,
	actions,
	onRefused,
}: {
	expanded: boolean;
	onToggle: () => void;
	actions: ActionDef[];
	/**
	 * Report a refusal here instead of beside the buttons. The pending-invite
	 * row unmounts when a withdrawn invite refreshes away, and a message inside
	 * that row would leave with it.
	 */
	onRefused?: (message: string | null) => void;
}) {
	const { run, pending, error, clearError } = useAction(invoke);
	// Which button was pressed, so only that one shows "…" while the save runs.
	const [pressed, setPressed] = useState<string | null>(null);

	function perform(action: ActionDef) {
		setPressed(action.label);
		clearError();
		onRefused?.(null);
		void run(action.perform).then((result) => {
			if (!result.ok && result.error !== "unauthorized") {
				onRefused?.(result.message ?? "Something went wrong. Please try again.");
			}
		});
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
			{!onRefused && error && <p className="text-xs text-red-500 max-w-[160px] text-right leading-tight">{error}</p>}
			{actions.map((action) => {
				const danger = (action.tone ?? "danger") === "danger";
				return (
					<button
						key={action.label}
						onClick={() => perform(action)}
						disabled={pending}
						className={`text-xs px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-brown/20 ${
							danger
								? "bg-white border border-red-300 text-red-600 hover:bg-red-50"
								: "bg-moss-green text-white hover:opacity-90"
						}`}
					>
						{pending && pressed === action.label ? "..." : action.label}
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
	perform,
}: {
	items: ConnectionItem[];
	emptyLabel: string;
	expandedId: string | null;
	onToggle: (id: string | null) => void;
	actionLabel: string;
	perform: (item: ConnectionItem) => Perform;
}) {
	if (!items.length) return <EmptyMessage label={emptyLabel} />;
	return (
		<div className="p-5 space-y-2">
			{items.map((item) => {
				const entity = item.type === "USER" ? item.user : item.page;
				if (!entity) return null;
				return (
					<ProfileTag
						key={item.id}
						entity={entity}
						actions={
							<ExpandableActions
								expanded={expandedId === item.id}
								onToggle={() => onToggle(expandedId === item.id ? null : item.id)}
								actions={[{ label: actionLabel, perform: perform(item) }]}
							/>
						}
					/>
				);
			})}
		</div>
	);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ConnectionsPageView({ entity, currentUserId, data, initialTab }: ConnectionsPageViewProps) {
	const isPage = isCardPage(entity);
	const entityType = isPage ? "page" : "user";
	const role = isPage ? (entity as CardPageWithRole).role : undefined;
	const displayName = isPage ? entity.name : getCardUserDisplayName(entity);

	const leftTabs: TabDef<string>[] = [{ id: entity.id, label: displayName }];

	// Who may act on requests: a page ADMIN, or a user on their own profile.
	// Page requests are ADMIN-only (matching member management), so this mirrors
	// the server gate — an EDITOR sees no Requests tab.
	const isAdmin = isAdminRole(role);
	const canManageRequests = isPage ? isAdmin : entity.id === currentUserId;

	const topTabs: TabDef<TopTab>[] = [
		{ id: "Followers", label: "Followers" },
		{ id: "Following", label: "Following" },
		{ id: "Membership", label: "Membership" },
		...(canManageRequests ? [{ id: "Requests" as const, label: "Requests" }] : []),
	];

	// Active top tab. Left `undefined` so TabbedPanel stays uncontrolled (defaults to Followers)
	// unless a deep-link names a tab this viewer can see.
	const [activeTop, setActiveTop] = useState<TopTab | undefined>(() =>
		topTabs.find((t) => t.id === initialTab)?.id,
	);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [showAddMember, setShowAddMember] = useState(false);
	// Explicit-pick add flow: hold the selected user + chosen role until confirmed,
	// rather than granting MEMBER immediately on select.
	const [pendingUser, setPendingUser] = useState<SearchResultUser | null>(null);
	const [pendingRole, setPendingRole] = useState<PermissionRole>("EDITOR");
	// Invite-via-email modal: null = closed, else the address field's prefill.
	const [emailInvitePrefill, setEmailInvitePrefill] = useState<string | null>(null);
	const [inviteNotice, setInviteNotice] = useState<string | null>(null);
	// An invite the page's policy no longer allows is deleted on accept. The row
	// goes away with the refresh, so the explanation has to live outside it.
	const [inviteRefusal, setInviteRefusal] = useState<string | null>(null);
	const roleChoices = assignableRoles(data.membershipPolicy);

	const invite = useAction(inviteMemberAction);
	// Role chips run a save from inside a menu; one runner reports their pending/error.
	const roleSave = useAction(invoke);

	// ProfileSearchDropdown's onSelect is fire-and-forget: just capture the picked user
	// and default the role; the admin confirms an explicit role before we invite. (Adding
	// a person is now a real ADMIN/EDITOR grant, so it must be a deliberate choice.)
	function selectPendingUser(user: SearchResultUser) {
		invite.clearError();
		setPendingRole(roleChoices[roleChoices.length - 1]);
		setPendingUser(user);
	}

	function cancelAddMember() {
		setShowAddMember(false);
		setPendingUser(null);
		invite.clearError();
	}

	function openEmailInvite(query: string) {
		invite.clearError();
		setInviteNotice(null);
		// Carry over an address typed into the search; anything else isn't worth prefilling.
		setEmailInvitePrefill(query.includes("@") ? query : "");
	}

	// The invites are saved and the page refreshed by the modal's action; this only closes the
	// modal and says what happened.
	function onEmailInvitesSent(result: { sent: number; alreadyMembers: string[] }) {
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
	}

	async function confirmAddMember() {
		if (!pendingUser) return;
		const result = await invite.run({ pageId: entity.id, userId: pendingUser.id, role: pendingRole });
		if (result.ok) {
			setShowAddMember(false);
			setPendingUser(null);
		}
	}

	function getCount(_leftId: string, top: TopTab): number {
		if (top === "Followers") return data.followers.length;
		if (top === "Following") return data.following.length;
		if (top === "Requests") return data.requests.length;
		return entityType === "user"
			? data.memberOf.length + data.invites.length
			: data.members.length + data.emailInvites.length;
	}

	function renderContent(_leftId: string, top: TopTab) {
		if (top === "Followers") {
			return (
				<ConnectionList
					items={data.followers}
					emptyLabel="Followers"
					expandedId={expandedId}
					onToggle={setExpandedId}
					actionLabel="Remove Follower"
					perform={(item) => () =>
						removeFollowerAction({ target: { type: entityType, id: entity.id }, followId: item.id })
					}
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
					perform={(item) => () =>
						setFollow({
							target: item.type === "USER" ? { type: "user", id: item.user!.id } : { type: "page", id: item.page!.id },
							follow: false,
						})
					}
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
						return (
							<ProfileTag
								key={req.id}
								entity={requesterEntity}
								badge={badge}
								actions={
									<ExpandableActions
										expanded={expandedId === req.id}
										onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
										actions={[
											{ label: "Approve", tone: "default", perform: () => approveRequestAction({ requestId: req.id }) },
											{ label: "Deny", perform: () => denyRequestAction({ requestId: req.id }) },
										]}
									/>
								}
							/>
						);
					})}
				</div>
			);
		}

		// Membership tab — user profile: pages the user is a member of
		if (entityType === "user") {
			const items = data.memberOf;
			const invites = data.invites.filter((inv) => inv.page);
			const membershipsEmpty = !items.length && !invites.length;
			if (membershipsEmpty && !inviteRefusal) return <EmptyMessage label="Memberships" />;
			return (
				<div className="p-5 space-y-2">
					{inviteRefusal && (
						<p role="alert" className="text-xs text-red-500">{inviteRefusal}</p>
					)}
					{membershipsEmpty && <EmptyMessage label="Memberships" />}
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
										onRefused={setInviteRefusal}
										actions={[
											{ label: "Accept", tone: "default", perform: () => approveRequestAction({ requestId: inv.id }) },
											{ label: "Decline", perform: () => denyRequestAction({ requestId: inv.id }) },
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
									actions={[{ label: "Leave", perform: () => leavePageAction({ pageId: item.page.id }) }]}
								/>
							}
						/>
					))}
				</div>
			);
		}

		// Membership tab — page profile. `isAdmin` is hoisted to component scope.
		const items = data.members;
		const emailInvites = data.emailInvites;

		return (
			<div className="p-5 space-y-2">
				{!items.length && !emailInvites.length && <EmptyMessage label="Members" />}
				{roleSave.error && <p role="alert" className="text-xs text-red-500 text-center">{roleSave.error}</p>}
				{items.map((item) => {
					if (item.pending) {
						return (
							<ProfileTag
								key={item.id}
								entity={item.user}
								badge={isAdmin ? (
									<span className="inline-flex items-center gap-1.5">
										<span className="text-xs text-dusty-grey">Pending</span>
										<RoleSelector
											current={item.role}
											roles={roleChoices}
											onChange={async (next) => {
												// Re-inviting someone updates the role on their open invite.
												await roleSave.run(() =>
													inviteMemberAction({ pageId: entity.id, userId: item.user.id, role: next }),
												);
											}}
										/>
									</span>
								) : `Pending · invited as ${formatRole(item.role)}`}
								actions={
									isAdmin ? (
										<ExpandableActions
											expanded={expandedId === item.id}
											onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
											actions={[{ label: "Cancel", perform: () => denyRequestAction({ requestId: item.id }) }]}
										/>
									) : undefined
								}
							/>
						);
					}
					const manageable = isAdmin && item.user.id !== currentUserId;
					return (
						<ProfileTag
							key={item.id}
							entity={item.user}
							badge={
								manageable ? (
									<RoleSelector
										current={item.role}
										roles={roleChoices}
										onChange={async (next) => {
											await roleSave.run(() =>
												changeMemberRoleAction({ pageId: entity.id, userId: item.user.id, role: next }),
											);
										}}
									/>
								) : formatRole(item.role)
							}
							actions={
								manageable ? (
									<ExpandableActions
										expanded={expandedId === item.id}
										onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
										actions={[{
											label: "Remove from group",
											perform: () => removeMemberAction({ pageId: entity.id, userId: item.user.id }),
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
									perform: () => cancelEmailInviteAction({ pageId: entity.id, inviteId: inv.id }),
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
													onChange={async (next) => setPendingRole(next as PermissionRole)}
												/>
												<button
													onClick={confirmAddMember}
													disabled={invite.pending}
													className="text-xs px-3 py-1 rounded-md font-medium bg-moss-green text-white hover:opacity-90 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
												>
													{invite.pending ? "..." : "Invite"}
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
										excludeUserIds={data.members.map((m) => m.user.id)}
										onSelect={selectPendingUser}
										placeholder="Search by name or handle..."
										extraOption={{ label: "Invite via email", onSelect: openEmailInvite }}
									/>
								)}
								{invite.error && (
									<p className="text-xs text-red-500 text-center">{invite.error}</p>
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
