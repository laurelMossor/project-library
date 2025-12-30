import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.supabase.co",
				pathname: "/storage/**",
			},
		],
	},
	async rewrites() {
		// If any stored image URLs are relative like `/uploads/projects/<file>`,
		// rewrite them to the public Supabase Storage bucket named `uploads`.
		//
		// NOTE: This expects NEXT_PUBLIC_SUPABASE_URL to be your Supabase project URL,
		// e.g. `https://xxxxx.supabase.co`
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

		if (!supabaseUrl) return [];

		return [
			{
				source: "/uploads/:path*",
				destination: `${supabaseUrl}/storage/v1/object/public/uploads/:path*`,
			},
		];
	},
};

export default nextConfig;

