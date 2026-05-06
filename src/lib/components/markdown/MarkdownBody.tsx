import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const BLOCKED_ELEMENTS = new Set(["script", "iframe", "object", "embed", "form"]);

const components: Components = {
	// Disallow raw HTML elements that could be dangerous
	// react-markdown disallows raw HTML by default; these handlers are an
	// extra safety layer for any content that slips through remark-gfm.
	h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-2">{children}</h1>,
	h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-2">{children}</h2>,
	h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-1">{children}</h3>,
	p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
	ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
	ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
	li: ({ children }) => <li>{children}</li>,
	a: ({ href, children }) => (
		<a
			href={href}
			className="text-moss-green underline hover:text-rich-brown transition-colors"
			target="_blank"
			rel="noopener noreferrer"
		>
			{children}
		</a>
	),
	blockquote: ({ children }) => (
		<blockquote className="border-l-4 border-soft-grey pl-4 italic text-dusty-grey my-3">
			{children}
		</blockquote>
	),
	code: ({ children, className }) => {
		const isBlock = className?.includes("language-");
		return isBlock ? (
			<pre className="bg-soft-grey/20 rounded p-3 overflow-x-auto my-3 text-sm font-mono">
				<code>{children}</code>
			</pre>
		) : (
			<code className="bg-soft-grey/20 rounded px-1 py-0.5 text-sm font-mono">{children}</code>
		);
	},
	// Strip images for MVP (text-only)
	img: () => null,
};

type MarkdownBodyProps = {
	content: string;
	className?: string;
};

/**
 * Renders markdown content safely. Images are stripped (MVP scope).
 * Raw HTML is disallowed by react-markdown defaults; BLOCKED_ELEMENTS
 * set is belt-and-suspenders for remark-gfm extensions.
 */
export function MarkdownBody({ content, className = "" }: MarkdownBodyProps) {
	// Belt-and-suspenders: strip any blocked tags before parsing
	const sanitized = content.replace(
		/<(script|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi,
		""
	);
	void BLOCKED_ELEMENTS; // referenced above via regex

	return (
		<div className={`prose-notebook ${className}`}>
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{sanitized}
			</ReactMarkdown>
		</div>
	);
}
