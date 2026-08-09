/**
 * Tests for ProfileSettingsClient's visibility gate.
 *
 * The consolidated Profile Settings page shows the profile/content visibility controls only
 * when the acting identity may change them: always for a personal profile, but ADMIN-only for
 * a page (a non-admin EDITOR sees just the notifications section). The server also enforces this
 * in saveMyProfile — this test guards the client half so a future refactor can't silently drop it.
 *
 * The two heavy children are mocked to sentinels: NotificationSettingsForm fetches on mount, and
 * VisibilityField pulls the whole selector/inline-field stack. That keeps the test on the gate
 * (visibility block present/absent) rather than incidental rendering. useActiveProfile and fetch
 * are mocked — no network or session required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";

vi.mock("@/lib/contexts/ActiveProfileContext", () => ({ useActiveProfile: vi.fn() }));
vi.mock("@/app/settings/profile/NotificationSettingsForm", () => ({
  NotificationSettingsForm: () => <div>NOTIFICATIONS_SECTION</div>,
}));
vi.mock("@/lib/components/visibility/VisibilityField", () => ({
  VisibilityField: () => <div>VISIBILITY_CONTROLS</div>,
}));

import { ProfileSettingsClient } from "@/app/settings/profile/ProfileSettingsClient";

/** useActiveProfile stub — only the fields ProfileSettingsClient reads. */
function mockProfile(activePageId: string | null, role?: string) {
  const pages = activePageId ? [{ id: activePageId, name: "Makers", handle: "makers", role, avatarImageId: null, avatarImage: null }] : [];
  vi.mocked(useActiveProfile).mockReturnValue({ activePageId, pages, loading: false } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  // GET /api/me/{user,page} → the visibility fields for the active identity.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "e-1", profileVisibility: "PUBLIC", contentVisibility: "LISTED" }),
  } as never);
});

describe("ProfileSettingsClient visibility gate", () => {
  test("personal identity → visibility controls shown (a user always controls their own)", async () => {
    mockProfile(null);
    render(<ProfileSettingsClient />);
    await waitFor(() => expect(screen.getByText("VISIBILITY_CONTROLS")).toBeDefined());
    expect(screen.getByText("NOTIFICATIONS_SECTION")).toBeDefined();
  });

  test("page ADMIN → visibility controls shown", async () => {
    mockProfile("page-1", "ADMIN");
    render(<ProfileSettingsClient />);
    await waitFor(() => expect(screen.getByText("VISIBILITY_CONTROLS")).toBeDefined());
    expect(screen.getByText("NOTIFICATIONS_SECTION")).toBeDefined();
  });

  test("page EDITOR → visibility controls hidden, notifications still shown", async () => {
    mockProfile("page-1", "EDITOR");
    render(<ProfileSettingsClient />);
    // Notifications renders unconditionally — wait on it so the async load has settled,
    // then assert the visibility block never appeared for a non-admin editor.
    await waitFor(() => expect(screen.getByText("NOTIFICATIONS_SECTION")).toBeDefined());
    expect(screen.queryByText("VISIBILITY_CONTROLS")).toBeNull();
  });
});
