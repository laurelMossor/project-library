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
		// Rewrite image requests to Supabase Storage
		// 
		// Example images are stored in:
		// - Local: public/static/examples/
		// - Supabase: uploads bucket at path "examples/"
		// - Database: path stored as "examples/filename.png"
		//
		// When app requests /uploads/examples/image.png, rewrite to:
		// ${supabaseUrl}/storage/v1/object/public/uploads/examples/image.png
		//
		// NOTE: This expects NEXT_PUBLIC_SUPABASE_URL to be your Supabase project URL,
		// e.g. `https://xxxxx.supabase.co`
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

		if (!supabaseUrl) return [];

		return [
			{
				source: "/uploads/examples/:path*",
				destination: `${supabaseUrl}/storage/v1/object/public/uploads/examples/:path*`,
			},
		];
	},
};

export default nextConfig;

