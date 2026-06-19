/**
 * Unit tests for the sendEmail() choke point — the swappable provider seam.
 * Resend client and template rendering are mocked; no network, no credentials.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

// vi.hoisted so the (hoisted) vi.mock factory can reference getResendClient.
const { getResendClient } = vi.hoisted(() => ({ getResendClient: vi.fn() }));

vi.mock("@/lib/email/client", () => ({
	getResendClient,
	getFromAddress: () => "The Project Library <from@test.dev>",
}));
vi.mock("@react-email/components", () => ({
	render: vi.fn().mockResolvedValue("rendered email text"),
}));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));

import { sendEmail } from "@/lib/email/send";
import { logAction } from "@/lib/utils/server/log";

const dummyReact = {} as ReactElement;

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendEmail dev fallback (no RESEND_API_KEY)", () => {
	test("logs instead of sending and reports ok", async () => {
		getResendClient.mockReturnValue(null);

		const result = await sendEmail({ to: "a@b.com", subject: "Hi", react: dummyReact });

		expect(result).toEqual({ ok: true });
		expect(console.log).toHaveBeenCalled();
	});
});

describe("sendEmail with a configured client", () => {
	test("calls the provider once with from/to/subject", async () => {
		const send = vi.fn().mockResolvedValue({ error: null });
		getResendClient.mockReturnValue({ emails: { send } });

		const result = await sendEmail({ to: "a@b.com", subject: "Hi", react: dummyReact });

		expect(result).toEqual({ ok: true });
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({ to: "a@b.com", subject: "Hi" }),
		);
	});

	test("provider error → ok:false and logs the failure", async () => {
		const send = vi.fn().mockResolvedValue({ error: { message: "domain not verified" } });
		getResendClient.mockReturnValue({ emails: { send } });

		const result = await sendEmail({ to: "a@b.com", subject: "Hi", react: dummyReact });

		expect(result.ok).toBe(false);
		expect(logAction).toHaveBeenCalledWith(
			"email.send_failed",
			undefined,
			expect.objectContaining({ to: "a@b.com" }),
		);
	});
});
