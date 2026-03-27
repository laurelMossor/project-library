// ⚠️ SERVER-ONLY
// Structured action logging — outputs JSON to stdout, captured by Vercel logs

export function logAction(
	action: string,
	userId?: string,
	meta?: Record<string, unknown>
): void {
	console.log(
		JSON.stringify({
			type: "action",
			action,
			userId,
			meta,
			ts: new Date().toISOString(),
		})
	);
}
