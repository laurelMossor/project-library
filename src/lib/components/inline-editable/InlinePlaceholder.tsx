import { type ReactNode } from "react";

type InlinePlaceholderProps = {
	value: string | null | undefined;
	placeholder: string;
	children?: ReactNode;
};

/**
 * Renders `children` when value is present, a muted placeholder when it isn't.
 * Keeps the distinction between "content" and "waiting for content" clear
 * without repeating the conditional/styling logic at every call site.
 */
export function InlinePlaceholder({ value, placeholder, children }: InlinePlaceholderProps) {
	if (!value) {
		return (
			<span className="text-misty-forest/60 italic font-normal">
				{placeholder}
			</span>
		);
	}
	return <>{children}</>;
}
