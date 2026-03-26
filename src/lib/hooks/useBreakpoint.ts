"use client";

import { useState, useEffect } from "react";

/**
 * Generic hook for responsive values based on viewport width.
 * Handles SSR safety, state initialization, and resize listener boilerplate.
 */
export function useBreakpoint<T>(getter: () => T, initialValue: T): T {
	const [value, setValue] = useState<T>(initialValue);

	useEffect(() => {
		const handle = () => setValue(getter());
		handle();
		window.addEventListener("resize", handle);
		return () => window.removeEventListener("resize", handle);
	}, []);

	return value;
}
