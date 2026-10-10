export type SubmissionStatus = "PENDING" | "READY" | "NEEDS_FIX" | "FAILED" | "PUBLISHED" | "REJECTED";

/** A Poster Catcher submission as the review surface renders it (poster url included). */
export type ReviewSubmission = {
	id: string;
	status: SubmissionStatus;
	submittedAt: Date;
	sourceUrl: string | null;
	rawCaption: string | null;
	rawImage: { url: string } | null;
	title: string | null;
	content: string | null;
	eventDate: Date | null;
	eventTimezone: string | null;
	location: string | null;
	latitude: number | null;
	longitude: number | null;
	tags: string[];
	errorNote: string | null;
};

/** Fields the operator may edit in review. All optional; date is ISO string or null. */
export type SubmissionEdits = {
	title?: string | null;
	content?: string | null;
	eventDate?: string | null;
	eventTimezone?: string | null;
	location?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
};
