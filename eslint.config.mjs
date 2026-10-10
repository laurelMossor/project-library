import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
	{
		ignores: [".next/**", "node_modules/**", "out/**", "build/**", "public/**", "*.config.*"],
	},
	{
		files: ["**/*.{js,jsx,ts,tsx}"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
			react,
			"react-hooks": reactHooks,
		},
		settings: {
			react: {
				version: "detect",
			},
		},
		rules: {
			// Basic rules
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
			"no-console": "warn",
			"react/react-in-jsx-scope": "off", // Not needed in Next.js
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
		},
	},
	// Server-side code: console.error/log is intentional structured logging
	{
		files: [
			"src/app/api/**",
			"src/lib/utils/server/**",
			"src/lib/auth.ts",
			"src/proxy.ts",
			"scripts/**",
			"tests/**",
		],
		rules: {
			"no-console": "off",
		},
	},
	// UI saves go through Server Actions (src/lib/actions, built on authedAction/publicAction),
	// never a client fetch with a mutating method. Covers all UI code; route handlers are the
	// HTTP surface for outside callers. The one sanctioned client POST, the multipart image
	// upload, lives in src/lib/utils/image-client.ts.
	{
		files: ["src/app/**", "src/lib/components/**", "src/lib/hooks/**", "src/lib/contexts/**"],
		ignores: ["src/app/api/**"],
		rules: {
			"no-restricted-syntax": [
				"error",
				{
					selector: "Property[key.name='method'][value.value=/^(POST|PATCH|PUT|DELETE)$/i]",
					message: "Save through a Server Action in src/lib/actions (see PROJECT_GUIDELINES 'Data & saves'), not a client fetch.",
				},
			],
		},
	},
];

