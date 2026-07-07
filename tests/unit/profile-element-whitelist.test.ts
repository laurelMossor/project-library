/**
 * Unit tests for the element-update whitelist (INV-6). updateProfileElement must
 * never let a client set ownership columns (userId/pageId) or id on an existing
 * element — otherwise an update could reassign, orphan, or double-own the row.
 *
 * Prisma is mocked (pickElementFields is pure, but the module imports prisma).
 */
import { describe, test, expect, vi } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: {} }));

import { pickElementFields, ELEMENT_MUTABLE_KEYS } from "@/lib/utils/server/profile-element";

describe("pickElementFields (INV-6 mass-assignment guard)", () => {
	test("keeps the whitelisted mutable keys", () => {
		expect(
			pickElementFields({
				kind: "LINK",
				label: "Site",
				value: "https://x.com",
				caption: "hi",
				url: "https://x.com",
				sortOrder: 3,
				visible: false,
			})
		).toEqual({
			kind: "LINK",
			label: "Site",
			value: "https://x.com",
			caption: "hi",
			url: "https://x.com",
			sortOrder: 3,
			visible: false,
		});
	});

	test("drops userId (ownership reassignment attempt)", () => {
		expect(pickElementFields({ value: "v", userId: "victim-user" })).toEqual({ value: "v" });
	});

	test("drops pageId (double-own / cross-scope attempt)", () => {
		expect(pickElementFields({ value: "v", pageId: "any-page" })).toEqual({ value: "v" });
	});

	test("drops a null userId (orphaning attempt)", () => {
		expect(pickElementFields({ value: "v", userId: null })).toEqual({ value: "v" });
	});

	test("drops id and unknown keys", () => {
		expect(pickElementFields({ id: "other", value: "v", createdAt: "x", foo: 1 })).toEqual({ value: "v" });
	});

	test("omits undefined values", () => {
		expect(pickElementFields({ label: undefined, value: "v" })).toEqual({ value: "v" });
	});

	test("ownership columns are not in the whitelist", () => {
		expect(ELEMENT_MUTABLE_KEYS).not.toContain("userId");
		expect(ELEMENT_MUTABLE_KEYS).not.toContain("pageId");
	});
});
