import { describe, expect, test } from "vitest";
import { draftPlacement } from "@/lib/utils/draft-placement";
import { NEW_IN_OWN_PROFILE } from "@/lib/const/routes";

describe("draftPlacement", () => {
	test("with no target, the active profile decides", () => {
		expect(draftPlacement(null, null)).toEqual({ asPageId: null, pageId: null });
		expect(draftPlacement(null, "page-1")).toEqual({ asPageId: "page-1", pageId: null });
	});

	test("from your own profile, you speak as yourself even while acting as a page", () => {
		expect(draftPlacement(NEW_IN_OWN_PROFILE, "page-1")).toEqual({ asPageId: null, pageId: null });
	});

	test("from a page you're acting as, the draft speaks as that page", () => {
		expect(draftPlacement("page-1", "page-1")).toEqual({ asPageId: "page-1", pageId: "page-1" });
	});

	test("from any other page, the draft goes to it in your own voice", () => {
		expect(draftPlacement("page-1", null)).toEqual({ asPageId: null, pageId: "page-1" });
		expect(draftPlacement("page-1", "page-2")).toEqual({ asPageId: null, pageId: "page-1" });
	});
});
