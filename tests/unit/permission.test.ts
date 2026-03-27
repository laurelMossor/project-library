/**
 * ⚠️  AUTHORIZATION GAP — canPostAsPage IS UNTESTED
 *
 * canPostAsPage() is the gatekeeper for all "post/message as a Page" actions.
 * It checks the Permission table for ADMIN or EDITOR role before allowing
 * write operations. This is high-risk logic with NO test coverage.
 *
 * This test is intentionally left failing to block CI until proper tests
 * are written. canPostAsPage is currently mid-refactor — do not remove
 * this file, fix it.
 *
 * When ready, test at minimum:
 *   - ADMIN role → allowed
 *   - EDITOR role → allowed
 *   - MEMBER role → denied
 *   - No permission record → denied
 *   - Wrong resourceType → denied
 *   - Non-existent pageId → denied
 */
import { describe, test } from "vitest";

describe("canPostAsPage — permission checks", () => {
  test("FAILING PLACEHOLDER: canPostAsPage has no tests (refactor in progress)", () => {
    throw new Error(
      "canPostAsPage is untested. Write tests before this feature ships. " +
        "See src/lib/utils/server/permission.ts"
    );
  });
});
