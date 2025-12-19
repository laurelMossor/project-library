import { NextResponse } from "next/server";

// Standardized error response helpers for consistent API error handling
// These functions return NextResponse objects with appropriate status codes

export function unauthorized(message = "Unauthorized") {
	return NextResponse.json({ error: message }, { status: 401 });
}

export function notFound(message = "Resource not found") {
	return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message = "Internal server error") {
	return NextResponse.json({ error: message }, { status: 500 });
}

