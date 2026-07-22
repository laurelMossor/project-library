/**
 * Render smoke test for the grouped notification email. Uses the real @react-email renderer to prove
 * the profile-grouped table renders: multiple sections, one row per notification, a per-section
 * unsubscribe link, and the footer manage-preferences link.
 */
import { describe, test, expect } from "vitest";
import { render } from "@react-email/components";
import { NotificationEmail } from "@/lib/utils/server/email/templates/NotificationEmail";

describe("NotificationEmail", () => {
	test("renders every section, row, per-section unsubscribe, and the manage link", async () => {
		const html = await render(
			NotificationEmail({
				managePrefsUrl: "https://app.test/settings/notifications",
				sections: [
					{
						name: "Personal",
						handle: "alice",
						initial: "A",
						unsubscribeUrl: "https://app.test/unsubscribe?token=personal",
						rows: [
							{ text: "Sam commented on your post", href: "https://app.test/p/1" },
							{ text: "Jordan RSVP’d to your event", href: "https://app.test/e/2" },
						],
					},
					{
						name: "Repair Café",
						handle: "repair-cafe",
						initial: "R",
						unsubscribeUrl: "https://app.test/unsubscribe?token=page",
						rows: [{ text: "Dana asked to join your page", href: "https://app.test/connections" }],
					},
				],
			}),
		);

		// Both profile section headers
		expect(html).toContain("Personal");
		expect(html).toContain("Repair Café");
		// Every notification row
		expect(html).toContain("Sam commented on your post");
		expect(html).toContain("Jordan RSVP’d to your event");
		expect(html).toContain("Dana asked to join your page");
		// Deep links
		expect(html).toContain("https://app.test/p/1");
		// Distinct per-section unsubscribe links
		expect(html).toContain("https://app.test/unsubscribe?token=personal");
		expect(html).toContain("https://app.test/unsubscribe?token=page");
		// Footer manage-preferences link
		expect(html).toContain("https://app.test/settings/notifications");
		expect(html).toContain("Manage email preferences");
	});
});
