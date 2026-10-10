/**
 * Tests for ActiveProfileContext / useActiveProfile
 *
 * The acting identity is seeded from server props (initialCurrentUser / initialActivePage)
 * and re-synced when those props change — this is how a router.refresh() after an avatar/
 * profile edit reaches the nav. switchProfile runs setActivePageAction (a Server Action that
 * rewrites the session cookie). The action, fetch, and next-auth/react are mocked — no network
 * or session required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { ActiveProfileProvider, useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import type { CardUser, CardPageWithRole } from "@/lib/types/card";
import { useSession } from "next-auth/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/actions/session", () => ({ setActivePageAction: vi.fn() }));

import { setActivePageAction } from "@/lib/actions/session";

const mockUpdateSession = vi.fn().mockResolvedValue(undefined);

// Minimal shapes — only fields the context reads
const mockUser: CardUser = { id: "user-1", handle: "alice", displayName: "Alice Doe", avatarImageId: null, avatarImage: null };
const mockPage: CardPageWithRole = { id: "page-1", name: "Makers Guild", handle: "makers-guild", avatarImageId: null, avatarImage: null, role: "ADMIN" };

/**
 * Render the hook inside a provider whose props can be changed between renders
 * (simulating the layout re-running getActingIdentity on router.refresh()).
 */
function renderWithProps(initialCurrentUser: CardUser | null, initialActivePage: CardPageWithRole | null = null) {
  let props = { initialCurrentUser, initialActivePage };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ActiveProfileProvider {...props}>{children}</ActiveProfileProvider>
  );
  const utils = renderHook(() => useActiveProfile(), { wrapper });
  const setProps = (p: Partial<typeof props>) => {
    props = { ...props, ...p };
    utils.rerender();
  };
  return { ...utils, setProps };
}

function mockSession(activePageId: string | null = null) {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "user-1", activePageId } },
    update: mockUpdateSession,
    status: "authenticated",
  } as any);
}

/** Build a minimal Response-like mock for global.fetch */
function fetchOk(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);
}

// ---------------------------------------------------------------------------
describe("ActiveProfileContext", () => {
  beforeEach(() => vi.clearAllMocks());

  // -- Identity resolution from props --------------------------------------

  test("no session → currentUser and activeEntity are null even when a prop is seeded", async () => {
    vi.mocked(useSession).mockReturnValue({ data: null, update: mockUpdateSession, status: "unauthenticated" } as any);
    const { result } = renderWithProps(mockUser); // prop present, but session is gone
    await waitFor(() => expect(result.current.currentUser).toBeNull());
    expect(result.current.activeEntity).toBeNull();
  });

  test("session with no activePageId → activeEntity resolves to the seeded currentUser", async () => {
    mockSession(null);
    const { result } = renderWithProps(mockUser);
    await waitFor(() => expect(result.current.currentUser).toEqual(mockUser));
    expect(result.current.activeEntity).toEqual(mockUser);
    expect(result.current.activePageId).toBeNull();
    expect(result.current.activeRole).toBeNull();
  });

  test("session with activePageId → activeEntity resolves to the seeded active page", async () => {
    mockSession("page-1");
    const { result } = renderWithProps(mockUser, mockPage);
    await waitFor(() => expect(result.current.activeEntity).toEqual(mockPage));
    expect(result.current.activePageId).toBe("page-1");
    expect(result.current.activeRole).toBe("ADMIN");
  });

  test("stale/forbidden activePageId (no page prop) → nav falls back to personal, never blank", async () => {
    mockSession("page-gone"); // session claims a page, but server couldn't resolve it → prop null
    const { result } = renderWithProps(mockUser, null);
    await waitFor(() => expect(result.current.activeEntity).toEqual(mockUser));
  });

  // -- The bug fix: a fresh prop (router.refresh) updates the nav identity ---

  test("updated currentUser prop propagates to currentUser + activeEntity (the avatar-refresh path)", async () => {
    mockSession(null);
    const { result, setProps } = renderWithProps(mockUser);
    await waitFor(() => expect(result.current.currentUser).toEqual(mockUser));

    // Simulate router.refresh() → layout re-runs getActingIdentity → new prop with a new avatar
    const updated: CardUser = { ...mockUser, avatarImageId: "img-9", avatarImage: { url: "https://cdn/new.png" } };
    act(() => setProps({ initialCurrentUser: updated }));

    await waitFor(() => expect(result.current.currentUser).toEqual(updated));
    expect(result.current.activeEntity).toEqual(updated);
  });

  test("updated active page prop propagates to activeEntity while acting as that page", async () => {
    mockSession("page-1");
    const { result, setProps } = renderWithProps(mockUser, mockPage);
    await waitFor(() => expect(result.current.activeEntity).toEqual(mockPage));

    const updatedPage: CardPageWithRole = { ...mockPage, avatarImageId: "img-p", avatarImage: { url: "https://cdn/page.png" } };
    act(() => setProps({ initialActivePage: updatedPage }));

    await waitFor(() => expect(result.current.activeEntity).toEqual(updatedPage));
  });

  // -- switchProfile (unchanged: optimistic round-trip) ---------------------

  test("switchProfile(pageId) success → runs the action, re-reads the session, sets activeEntity to page", async () => {
    mockSession(null);
    vi.mocked(setActivePageAction).mockResolvedValue({ ok: true, data: undefined });
    global.fetch = vi.fn().mockReturnValueOnce(fetchOk(mockPage)); // fetch page after switch

    const { result } = renderWithProps(mockUser);
    await waitFor(() => expect(result.current.currentUser).toEqual(mockUser));

    await act(async () => { await result.current.switchProfile("page-1"); });

    expect(setActivePageAction).toHaveBeenCalledWith({ pageId: "page-1" });
    expect(mockUpdateSession).toHaveBeenCalledTimes(1);
    expect(result.current.activeEntity).toEqual(mockPage);
    expect(result.current.error).toBeNull();
  });

  test("switchProfile(pageId) refused → sets error and does not re-read the session", async () => {
    mockSession(null);
    vi.mocked(setActivePageAction).mockResolvedValue({
      ok: false,
      error: "forbidden",
      message: "You cannot act as this page",
    });

    const { result } = renderWithProps(mockUser);
    await waitFor(() => expect(result.current.currentUser).toEqual(mockUser));

    let switched = true;
    await act(async () => { switched = await result.current.switchProfile("page-1"); });

    expect(switched).toBe(false);
    expect(result.current.error).toBe("You cannot act as this page");
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  test("switchProfile(null) → runs the action with null, re-reads the session, resets activeEntity to currentUser", async () => {
    mockSession("page-1");
    vi.mocked(setActivePageAction).mockResolvedValue({ ok: true, data: undefined });

    const { result } = renderWithProps(mockUser, mockPage);
    await waitFor(() => expect(result.current.activeEntity).toEqual(mockPage));

    await act(async () => { await result.current.switchProfile(null); });

    expect(setActivePageAction).toHaveBeenCalledWith({ pageId: null });
    expect(mockUpdateSession).toHaveBeenCalledTimes(1);
    expect(result.current.activeEntity).toEqual(mockUser);
  });

  // -- fetchPages -----------------------------------------------------------

  test("fetchPages → filters to ADMIN/EDITOR, excludes MEMBER", async () => {
    mockSession(null);
    const pagesData = [
      { id: "p-1", name: "Alpha", handle: "alpha", role: "ADMIN",  avatarImageId: null, avatarImage: null },
      { id: "p-2", name: "Beta",  handle: "beta",  role: "EDITOR", avatarImageId: null, avatarImage: null },
      { id: "p-3", name: "Gamma", handle: "gamma", role: "MEMBER", avatarImageId: null, avatarImage: null },
    ];
    global.fetch = vi.fn().mockReturnValueOnce(fetchOk(pagesData));  // /api/me/pages

    const { result } = renderWithProps(mockUser);
    await waitFor(() => expect(result.current.currentUser).toEqual(mockUser));

    await act(async () => { await result.current.fetchPages(); });

    expect(result.current.pages).toHaveLength(2);
    expect(result.current.pages.map((p) => p.id)).toEqual(["p-1", "p-2"]);
    expect(result.current.pages.every((p) => ["ADMIN", "EDITOR"].includes(p.role))).toBe(true);
  });

  // -- Guard ----------------------------------------------------------------

  test("useActiveProfile throws when used outside ActiveProfileProvider", () => {
    expect(() => renderHook(() => useActiveProfile())).toThrow(
      "useActiveProfile must be used within an ActiveProfileProvider"
    );
  });
});
