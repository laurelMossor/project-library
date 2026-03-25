"use client";

import { useState, useEffect } from "react";

/**
 * Generic hook for responsive values based on viewport width.
 * Handles SSR safety, state initialization, and resize listener boilerplate.
 */
export function useBreakpoint<T>(getter: () => T): T {
	const [value, setValue] = useState(getter);

	useEffect(() => {
		const handle = () => setValue(getter());
		handle();
		window.addEventListener("resize", handle);
		return () => window.removeEventListener("resize", handle);
	}, []);

	return value;
}
