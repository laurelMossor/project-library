/**
 * Tests for ActiveProfileContext / useActiveProfile
 *
 * Covers: identity resolution, profile switching (success + 403), and fetchPages filtering.
 * fetch and next-auth/react are mocked — no network or session required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { ActiveProfileProvider, useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useSession } from "next-auth/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));

const mockUpdateSession = vi.fn().mockResolvedValue(undefined);

const wrapper = ({ children }: { children: ReactNode }) => (
  <ActiveProfileProvider>{children}</ActiveProfileProvider>
);

// Minimal shape — only fields the context reads
const mockUser = { id: "user-1", firstName: "Alice", lastName: "Doe" };
const mockPage = { id: "page-1", name: "Makers Guild", slug: "makers-guild" };

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
function fetchFail(data: unknown) {
  return Promise.resolve({ ok: false, json: () => Promise.resolve(data) } as Response);
}

// ---------------------------------------------------------------------------
describe("ActiveProfileContext", () => {
  beforeEach(() => vi.clearAllMocks());

  // -- Identity resolution --------------------------------------------------

  test("no session → currentUser and activeEntity are null", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, update: mockUpdateSession, status: "unauthenticated" } as any);
    const { result } = renderHook(() => useActiveProfile(), { wrapper });
    expect(result.current.currentUser).toBeNull();
    expect(result.current.activeEntity).toBeNull();
  });

  test("session with no activePageId → fetches user; activeEntity resolves to currentUser", async () => {
    mockSession(null);
    global.fetch = vi.fn().mockReturnValueOnce(fetchOk(mockUser)); // /api/me/user

    const { result } = renderHook(() => useActiveProfile(), { wrapper });

    await waitFor(() => expect(result.current.currentUser).toEqual(mockUser));
    expect(result.current.activeEntity).toEqual(mockUser);
    expect(result.current.activePageId).toBeNull();
  });

  test("session with activePageId → fetches page; activeEntity resolves to the page", async () => {
    mockSession("page-1");
    global.fetch = vi.fn()
      .mockReturnValueOnce(fetchOk(mockUser)) // /api/me/user
      .mockReturnValueOnce(fetchOk(mockPage)); // /api/me/page

    const { result } = renderHook(() => useActiveProfile(), { wrapper });

    await waitFor(() => expect(result.current.activeEntity).toEqual(mockPage));
    expect(result.current.activePageId).toBe("page-1");
  });

  // -- switchProfile --------------------------------------------------------

  test("switchProfile(pageId) success → calls PUT, updates session, sets activeEntity to page", async () => {
    mockSession(null);
    global.fetch = vi.fn()
      .mockReturnValueOnce(fetchOk(mockUser))                        // initial user fetch
      .mockReturnValueOnce(fetchOk({ activePageId: "page-1" }))     // PUT /api/session/active-page
      .mockReturnValueOnce(fetchOk(mockPage));                       // fetch page after switch

    const { result } = renderHook(() => useActiveProfile(), { wrapper });
    await waitFor(() => expect(result.current.currentUser).toEqual(mockUser));

    await act(async () => { await result.current.switchProfile("page-1"); });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/session/active-page",
      expect.objectContaining({ method: "PUT" })
    );
    expect(mockUpdateSession).toHaveBeenCalledWith({ activePageId: "page-1" });
    expect(result.current.activeEntity).toEqual(mockPage);
    expect(result.current.error).toBeNull();
  });

  test("switchProfile(pageId) → 403 sets error and does not update session", async () => {
    mockSession(null);
    global.fetch = vi.fn()
      .mockReturnValueOnce(fetchOk(mockUser))                                       // initial user fetch
      .mockReturnValueOnce(fetchFail({ error: "You cannot act as this page" }));    // PUT → 403

    const { result } = renderHook(() => useActiveProfile(), { wrapper });
    await waitFor(() => expect(result.current.currentUser).toEqual(mockUser));

    await act(async () => { await result.current.switchProfile("page-1"); });

    expect(result.current.error).toBe("You cannot act as this page");
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  test("switchProfile(null) → calls DELETE, updates session, resets activeEntity to currentUser", async () => {
    mockSession("page-1");
    global.fetch = vi.fn()
      .mockReturnValueOnce(fetchOk(mockUser))              // initial user fetch
      .mockReturnValueOnce(fetchOk(mockPage))              // initial page fetch (activePageId set)
      .mockReturnValueOnce(fetchOk({ activePageId: null })); // DELETE /api/session/active-page

    const { result } = renderHook(() => useActiveProfile(), { wrapper });
    await waitFor(() => expect(result.current.activeEntity).toEqual(mockPage));

    await act(async () => { await result.current.switchProfile(null); });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/session/active-page",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(mockUpdateSession).toHaveBeenCalledWith({ activePageId: null });
    expect(result.current.activeEntity).toEqual(mockUser);
  });

  // -- fetchPages -----------------------------------------------------------

  test("fetchPages → filters to ADMIN/EDITOR, excludes MEMBER", async () => {
    mockSession(null);
    const pagesData = [
      { id: "p-1", name: "Alpha", slug: "alpha", role: "ADMIN",  avatarImageId: null, avatarImage: null },
      { id: "p-2", name: "Beta",  slug: "beta",  role: "EDITOR", avatarImageId: null, avatarImage: null },
      { id: "p-3", name: "Gamma", slug: "gamma", role: "MEMBER", avatarImageId: null, avatarImage: null },
    ];
    global.fetch = vi.fn()
      .mockReturnValueOnce(fetchOk(mockUser))    // initial user fetch
      .mockReturnValueOnce(fetchOk(pagesData));  // /api/me/pages

    const { result } = renderHook(() => useActiveProfile(), { wrapper });
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
