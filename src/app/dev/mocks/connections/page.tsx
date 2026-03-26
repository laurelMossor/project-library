"use client";

import { TabbedPanel, TabDef } from "@/lib/components/ui/TabbedPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type TopTab = "Followers" | "Following" | "Admins";
type LeftTab = "Me" | "Berkeley Builders Collective";

type MockUser = {
  id: string;
  name: string;
  username: string;
  initial: string;
};

/**
 * Extends TabDef for the left axis.
 * Left tabs represent profiles the current user has adminship of.
 * `isSelf` marks the user's own profile vs. a managed page/group.
 */
type AdminProfileTab = TabDef<LeftTab> & {
  isSelf: boolean;
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TOP_TABS: TabDef<TopTab>[] = [
  { id: "Followers", label: "Followers" },
  { id: "Following", label: "Following" },
  { id: "Admins", label: "Admins" },
];

const LEFT_TABS: AdminProfileTab[] = [
  { id: "Me", label: "Me", isSelf: true },
  { id: "Berkeley Builders Collective", label: "Berkeley Builders Collective", isSelf: false },
];

// ─── Mock data ────────────────────────────────────────────────────────────────

const CONNECTIONS: Record<LeftTab, Record<TopTab, MockUser[]>> = {
  "Me": {
    Followers: [
      { id: "1", name: "Maren Ellis", username: "maren.e", initial: "M" },
      { id: "2", name: "Theo Caldwell", username: "theocald", initial: "T" },
      { id: "3", name: "Priya Nair", username: "priya_n", initial: "P" },
      { id: "4", name: "Jonah Ferris", username: "jonahf", initial: "J" },
      { id: "5", name: "Cecile Morin", username: "c.morin", initial: "C" },
    ],
    Following: [
      { id: "6", name: "Lena Holt", username: "lenaholt", initial: "L" },
      { id: "7", name: "Darcy Wren", username: "d_wren", initial: "D" },
      { id: "8", name: "Omar Ibarra", username: "oibarra", initial: "O" },
    ],
    Admins: [
    ],
  },
  "Berkeley Builders Collective": {
    Followers: [
      { id: "11", name: "Rowan Tate", username: "rowan.t", initial: "R" },
      { id: "12", name: "Isla Byrne", username: "islabyrne", initial: "I" },
    ],
    Following: [
      { id: "13", name: "Felix Strand", username: "fstrand", initial: "F" },
      { id: "14", name: "Nadia Cross", username: "nadiac", initial: "N" },
      { id: "15", name: "Eli Marsh", username: "eli.m", initial: "E" },
      { id: "16", name: "Tova Bell", username: "tovabell", initial: "T" },
    ],
    Admins: [
      { id: "17", name: "Kit Marlowe", username: "kit.m", initial: "K" },
      { id: "18", name: "Sasha Vance", username: "svance", initial: "S" },
    ],
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserRow({ user }: { user: MockUser }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-melon-green flex items-center justify-center text-sm font-semibold text-moss-green shrink-0">
          {user.initial}
        </div>
        <div>
          <p className="text-sm font-medium text-rich-brown leading-tight">{user.name}</p>
          <p className="text-xs text-dusty-grey">@{user.username}</p>
        </div>
      </div>
      <button className="text-xs px-3 py-1 rounded border border-soft-grey text-misty-forest hover:border-misty-forest hover:text-warm-grey transition-colors cursor-pointer">
        View
      </button>
    </div>
  );
}

function ConnectionList({ users, label }: { users: MockUser[]; label: string }) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-dusty-grey text-center py-12">
        No {label.toLowerCase()} yet.
      </p>
    );
  }
  return (
    <div className="p-5 space-y-2">
      {users.map((user) => (
        <UserRow key={user.id} user={user} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsMockPage() {
  return (
    <div className="min-h-screen bg-grey-white flex justify-center p-4">
      <div className="w-full max-w-2xl">
        <TabbedPanel<TopTab, LeftTab>
          topTabs={TOP_TABS}
          leftTabs={LEFT_TABS}
          getCount={(left, top) => CONNECTIONS[left][top].length}
          renderLeftTab={(tab) => {
            const { label, isSelf } = tab as AdminProfileTab;
            return (
              <span className="flex flex-col items-end gap-0.5">
                <span>{label}</span>
                {!isSelf && (
                  <span className="text-[10px] font-normal opacity-50 tracking-wide uppercase">
                    admin
                  </span>
                )}
              </span>
            );
          }}
          renderContent={(left, top) => (
            <ConnectionList users={CONNECTIONS[left][top]} label={top} />
          )}
        />
      </div>
    </div>
  );
}
