// Client-safe date helper for the Poster Catcher validity contract.
//
// The hard gate for materializing a submission into an Event is a real, resolved,
// FUTURE date. This single parser is shared by extraction (initial status) and the
// review edits (status recompute on hand-fill), so the "is this date usable?" rule
// is defined once.

export type FutureDateResult = { date: Date | null; isFuture: boolean };

/** Parse an ISO datetime and report whether it is a valid future date. */
export function parseFutureEventDate(iso: string | null | undefined): FutureDateResult {
	if (!iso) return { date: null, isFuture: false };
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return { date: null, isFuture: false };
	return { date, isFuture: date.getTime() > Date.now() };
}
