/**
 * An open menu sits on an invisible full-screen layer. A click there closes the menu
 * and does not reach whatever is underneath. jsdom does not stack fixed layers, so
 * these tests click that layer directly.
 */
import { describe, test, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DropdownMenu } from "@/lib/components/ui/DropdownMenu";
import { DropdownShell } from "@/lib/components/profile/DropdownShell";

vi.stubGlobal("ResizeObserver", class {
	observe() {}
	unobserve() {}
	disconnect() {}
});

function backdrop(container: HTMLElement) {
	const layer = container.querySelector("div.fixed.inset-0[aria-hidden='true']");
	if (!(layer instanceof HTMLElement)) throw new Error("no dismiss backdrop");
	return layer;
}

describe("menu dismiss", () => {
	test("clicking the backdrop closes the menu and does not run a control underneath", () => {
		const onClose = vi.fn();
		const onFollow = vi.fn();
		const { container } = render(
			<>
				<DropdownMenu isOpen onClose={onClose} trigger={<span>Menu</span>} triggerAriaLabel="Menu">
					<button type="button">Inside</button>
				</DropdownMenu>
				<button type="button" onClick={onFollow}>Follow</button>
			</>,
		);

		fireEvent.click(backdrop(container));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onFollow).not.toHaveBeenCalled();
	});

	test("a button inside the menu still runs", () => {
		const onClose = vi.fn();
		const onPick = vi.fn();
		render(
			<DropdownMenu isOpen onClose={onClose} trigger={<span>Menu</span>} triggerAriaLabel="Menu">
				<button type="button" onClick={onPick}>Pick</button>
			</DropdownMenu>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Pick" }));

		expect(onPick).toHaveBeenCalledTimes(1);
		expect(onClose).not.toHaveBeenCalled();
	});

	test("clicking the profile picker backdrop closes it, and an option still runs", () => {
		const onOpenChange = vi.fn();
		const onPick = vi.fn();
		const { container } = render(
			<DropdownShell label="Post to a page?" optionCount={2} open onOpenChange={onOpenChange}>
				<button type="button" onClick={onPick}>Your profile</button>
			</DropdownShell>,
		);

		fireEvent.click(backdrop(container));
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(onPick).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Your profile" }));
		expect(onPick).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
	});
});
