import { describe, test, expect } from "vitest";
import { followedName, nameOrHandle } from "@/lib/utils/identity-name";

describe("nameOrHandle", () => {
  test("a blank or missing page name saves as the handle", () => {
    expect(nameOrHandle(null, "makers")).toBe("makers");
    expect(nameOrHandle(undefined, "makers")).toBe("makers");
    expect(nameOrHandle("", "makers")).toBe("makers");
    expect(nameOrHandle("   ", "makers")).toBe("makers");
  });

  test("a typed page name is kept", () => {
    expect(nameOrHandle("Makers Guild", "makers")).toBe("Makers Guild");
  });
});

describe("followedName", () => {
  test("null keeps following the handle", () => {
    expect(followedName(null, "alice")).toBe("alice");
  });

  test("a typed display name is kept, including blank", () => {
    expect(followedName("Alice Doe", "alice")).toBe("Alice Doe");
    expect(followedName("", "alice")).toBe("");
  });
});
