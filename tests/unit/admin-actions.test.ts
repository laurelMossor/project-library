/**
 * Poster Catcher review actions: superadmin-only (refused as not_found, matching the /admin layout's
 * existence-deny), a missing submission is not_found, and success refreshes the server-rendered list.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/event-submission", () => ({
	applySubmissionEdits: vi.fn(),
	rejectSubmission: vi.fn(),
	materializeSubmission: vi.fn(),
}));

import { refresh } from "next/cache";
import { publishSubmissionAction, rejectSubmissionAction, saveSubmissionEditsAction } from "@/lib/actions/admin";
import { applySubmissionEdits, materializeSubmission, rejectSubmission } from "@/lib/utils/server/event-submission";
import { getSessionContext } from "@/lib/utils/server/session";

const ORIGINAL = process.env.SUPERADMIN_USER_IDS;

beforeEach(() => {
	vi.clearAllMocks();
	process.env.SUPERADMIN_USER_IDS = "op";
	vi.mocked(getSessionContext).mockResolvedValue({ userId: "op", activePageId: null });
});

afterEach(() => {
	process.env.SUPERADMIN_USER_IDS = ORIGINAL;
});

describe("superadmin gate", () => {
	beforeEach(() => vi.mocked(getSessionContext).mockResolvedValue({ userId: "alice", activePageId: null }));

	test("every review action is refused as not_found and writes nothing", async () => {
		expect(await saveSubmissionEditsAction({ id: "s1", fields: { title: "x" } })).toMatchObject({ ok: false, error: "not_found" });
		expect(await rejectSubmissionAction({ id: "s1" })).toMatchObject({ ok: false, error: "not_found" });
		expect(await publishSubmissionAction({ id: "s1", eventId: "e1" })).toMatchObject({ ok: false, error: "not_found" });
		expect(applySubmissionEdits).not.toHaveBeenCalled();
		expect(rejectSubmission).not.toHaveBeenCalled();
		expect(materializeSubmission).not.toHaveBeenCalled();
	});
});

describe("as a superadmin", () => {
	test("save edits passes the fields through and refreshes the list", async () => {
		vi.mocked(applySubmissionEdits).mockResolvedValue({ id: "s1" } as never);
		expect(await saveSubmissionEditsAction({ id: "s1", fields: { title: "New" } })).toEqual({ ok: true, data: undefined });
		expect(applySubmissionEdits).toHaveBeenCalledWith("s1", { title: "New" });
		expect(refresh).toHaveBeenCalledOnce();
	});

	test("a missing submission is not_found", async () => {
		vi.mocked(applySubmissionEdits).mockResolvedValue(null);
		vi.mocked(rejectSubmission).mockResolvedValue(false);
		vi.mocked(materializeSubmission).mockResolvedValue(null);
		expect(await saveSubmissionEditsAction({ id: "gone", fields: {} })).toMatchObject({ ok: false, error: "not_found" });
		expect(await rejectSubmissionAction({ id: "gone" })).toMatchObject({ ok: false, error: "not_found" });
		expect(await publishSubmissionAction({ id: "gone", eventId: "e1" })).toMatchObject({ ok: false, error: "not_found" });
	});

	test("publish requires an event id", async () => {
		expect(await publishSubmissionAction({ id: "s1", eventId: "" })).toMatchObject({ ok: false, error: "invalid" });
		expect(materializeSubmission).not.toHaveBeenCalled();
	});

	test("publish materializes against the given event", async () => {
		vi.mocked(materializeSubmission).mockResolvedValue({ id: "s1" } as never);
		expect(await publishSubmissionAction({ id: "s1", eventId: "e1" })).toMatchObject({ ok: true });
		expect(materializeSubmission).toHaveBeenCalledWith("s1", "e1");
	});
});
