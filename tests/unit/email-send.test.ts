/**
 * Unit tests for the sendEmail() choke point — the swappable provider seam.
 * Resend client and template rendering are mocked; no network, no credentials.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

// vi.hoisted so the (hoisted) vi.mock factory can reference getResendClient.
const { getResendClient } = vi.hoisted(() => ({ getResendClient: vi.fn() }));

vi.mock("@/lib/utils/server/email/client", () => ({
	getResendClient,
	getFromAddress: () => "The Project Library <from@test.dev>",
}));
vi.mock("@react-email/components", () => ({
	render: vi.fn().mockResolvedValue("rendered email text"),
}));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));

import { sendEmail, sendEmailBatch } from "@/lib/utils/server/email/send";
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

	test("ships a plain-text part alongside the HTML", async () => {
		const send = vi.fn().mockResolvedValue({ error: null });
		getResendClient.mockReturnValue({ emails: { send } });

		await sendEmail({ to: "a@b.com", subject: "Hi", react: dummyReact });

		expect(send).toHaveBeenCalledWith(expect.objectContaining({ react: dummyReact, text: "rendered email text" }));
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

describe("sendEmailBatch", () => {
	const two = [
		{ to: "a@b.com", subject: "A", react: dummyReact },
		{ to: "c@d.com", subject: "C", react: dummyReact },
	];

	test("one provider call for the whole batch, each with a text part", async () => {
		const send = vi.fn().mockResolvedValue({ error: null });
		getResendClient.mockReturnValue({ batch: { send } });

		expect(await sendEmailBatch(two)).toEqual({ ok: true });
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][0]).toEqual([
			expect.objectContaining({ to: "a@b.com", subject: "A", text: "rendered email text" }),
			expect.objectContaining({ to: "c@d.com", subject: "C", text: "rendered email text" }),
		]);
	});

	test("dev fallback logs each email instead of sending", async () => {
		getResendClient.mockReturnValue(null);
		expect(await sendEmailBatch(two)).toEqual({ ok: true });
		expect(console.log).toHaveBeenCalledTimes(2);
	});

	test("empty batch is a no-op", async () => {
		expect(await sendEmailBatch([])).toEqual({ ok: true });
		expect(getResendClient).not.toHaveBeenCalled();
	});

	test("provider error → ok:false and logs", async () => {
		getResendClient.mockReturnValue({ batch: { send: vi.fn().mockResolvedValue({ error: { message: "rate limited" } }) } });
		expect((await sendEmailBatch(two)).ok).toBe(false);
		expect(logAction).toHaveBeenCalledWith("email.send_failed", undefined, expect.objectContaining({ count: 2 }));
	});
});
