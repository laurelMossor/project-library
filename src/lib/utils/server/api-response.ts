// ⚠️ SERVER-ONLY: API response utilities
// Provides consistent response envelope for all API endpoints

import { NextResponse } from "next/server";

/**
 * Standard API response envelope
 */
export type ApiResponse<T> = {
	data: T | null;
	error: ApiError | null;
};

export type ApiError = {
	code: string;
	message: string;
	details?: Record<string, unknown>;
};

/**
 * Create a successful response
 */
export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
	return NextResponse.json({ data, error: null }, { status });
}

/**
 * Create an error response
 */
export function error(
	code: string,
	message: string,
	status = 400,
	details?: Record<string, unknown>
): NextResponse<ApiResponse<null>> {
	return NextResponse.json(
		{ data: null, error: { code, message, details } },
		{ status }
	);
}

// Common error helpers
export const unauthorized = (message = "Authentication required") =>
	error("UNAUTHORIZED", message, 401);

export const forbidden = (message = "Access denied") =>
	error("FORBIDDEN", message, 403);

export const notFound = (message = "Resource not found") =>
	error("NOT_FOUND", message, 404);

export const badRequest = (message: string, details?: Record<string, unknown>) =>
	error("BAD_REQUEST", message, 400, details);

export const serverError = (message = "Internal server error") =>
	error("SERVER_ERROR", message, 500);
