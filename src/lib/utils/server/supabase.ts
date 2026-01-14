// ⚠️ SERVER-ONLY: Supabase client for server-side operations
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Get Supabase client (lazy-loaded)
 * Throws error only when actually used, not at module load time
 * This allows the app to start without Supabase configured for local development
 */
export function getSupabaseClient() {
	if (supabaseClient) {
		return supabaseClient;
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl) {
		throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set. Please check your environment variables.");
	}

	if (!supabaseServiceKey) {
		throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Please check your environment variables.");
	}

	// Use service role key for server-side operations (bypasses RLS)
	// TODO: Ensure RLS policies are enabled on user-owned tables in Supabase
	// The service role key bypasses RLS, so all authorization must be enforced in application code
	supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	return supabaseClient;
}

