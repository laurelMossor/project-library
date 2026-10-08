/**
 * ProfilePicture shows an uploaded photo when one exists, and a generated avatar otherwise.
 * The avatar is seeded by entity id, so a handle rename does not change the picture.
 */
import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import type { CardUser } from "@/lib/types/card";

function user(overrides: Partial<CardUser> = {}): CardUser {
	return {
		id: "user-1",
		handle: "sam",
		displayName: "Sam Lee",
		avatarImageId: null,
		avatarImage: null,
		...overrides,
	};
}

/** Mask ids come from useId and change per mount. The painted shapes are what the seed controls. */
function painted(svg: Element): string {
	return svg.outerHTML.replace(/id="[^"]*"/g, 'id="m"').replace(/url\(#[^)]*\)/g, "url(#m)");
}

describe("ProfilePicture", () => {
	test("uploaded photo renders an img whose alt is the display name", () => {
		const { container } = render(
			<ProfilePicture
				entity={user({ avatarImageId: "img-1", avatarImage: { url: "https://cdn.example/sam.jpg" } })}
			/>,
		);
		const img = container.querySelector("img");
		expect(img?.getAttribute("src")).toBe("https://cdn.example/sam.jpg");
		expect(img?.getAttribute("alt")).toBe("Sam Lee");
		expect(container.querySelector("svg")).toBeNull();
	});

	test("no photo renders an svg, no initials, and an aria-label of the display name", () => {
		const { container } = render(<ProfilePicture entity={user()} />);
		expect(container.querySelector("svg")).not.toBeNull();
		expect(container.textContent?.trim()).toBe("");
		expect(container.querySelector("a")?.getAttribute("aria-label")).toBe("Sam Lee");
	});

	test("the same id paints the same avatar; the handle does not; a different id does", () => {
		const { container } = render(
			<>
				<ProfilePicture entity={user({ id: "same" })} asLink={false} />
				<ProfilePicture entity={user({ id: "same", handle: "renamed", displayName: "Renamed" })} asLink={false} />
				<ProfilePicture entity={user({ id: "other" })} asLink={false} />
			</>,
		);
		const [same, renamed, other] = [...container.querySelectorAll("svg")].map(painted);
		expect(same).toBe(renamed);
		expect(same).not.toBe(other);
	});
});
