import { describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNameHandlePrefill } from "@/lib/hooks/useNameHandlePrefill";

function setup() {
	const setName = vi.fn();
	const setHandle = vi.fn();
	const { result } = renderHook(() => useNameHandlePrefill({ setName, setHandle }));
	return { prefill: result.current, setName, setHandle };
}

describe("useNameHandlePrefill", () => {
	test("typing a name first suggests the handle", () => {
		const { prefill, setHandle } = setup();
		prefill.onNameTyped("Ada Lovelace");
		expect(setHandle).toHaveBeenLastCalledWith("ada-lovelace");
	});

	test("typing a handle first suggests the name", () => {
		const { prefill, setName } = setup();
		prefill.onHandleTyped("adal");
		expect(setName).toHaveBeenLastCalledWith("adal");
	});

	test("once the handle is typed by hand, the name stops changing it", () => {
		const { prefill, setHandle } = setup();
		prefill.onNameTyped("Ada");
		prefill.onHandleTyped("countess");
		setHandle.mockClear();
		prefill.onNameTyped("Ada Lovelace");
		expect(setHandle).not.toHaveBeenCalled();
	});

	test("once the name is typed by hand, the handle stops changing it", () => {
		const { prefill, setName } = setup();
		prefill.onHandleTyped("adal");
		prefill.onNameTyped("Ada");
		setName.mockClear();
		prefill.onHandleTyped("adalovelace");
		expect(setName).not.toHaveBeenCalled();
	});

	test("a handle too short to be legal keeps the last good name suggestion", () => {
		const { prefill, setName } = setup();
		prefill.onHandleTyped("adal");
		setName.mockClear();
		prefill.onHandleTyped("ad");
		expect(setName).not.toHaveBeenCalled();
	});

	test("reset lets both fields fill each other again", () => {
		const { prefill, setHandle } = setup();
		prefill.onNameTyped("Ada");
		prefill.onHandleTyped("countess");
		prefill.reset();
		setHandle.mockClear();
		prefill.onNameTyped("Grace Hopper");
		expect(setHandle).toHaveBeenLastCalledWith("grace-hopper");
	});
});
