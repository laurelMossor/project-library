import { type ReactNode } from "react";

type InlinePlaceholderProps = {
	value: string | null | undefined;
	placeholder: string;
	children?: ReactNode;
	/**
	 * Render the empty state as a soft-bordered "+ {placeholder}" chip instead of muted
	 * italic text. Use for add-a-value fields (tags, interests) where the placeholder
	 * should read as an affordance you can click into; leave off for prose fields.
	 */
	chip?: boolean;
};

/**
 * Renders `children` when value is present, a muted placeholder when it isn't.
 * Keeps the distinction between "content" and "waiting for content" clear
 * without repeating the conditional/styling logic at every call site.
 */
export function InlinePlaceholder({ value, placeholder, children, chip = false }: InlinePlaceholderProps) {
	if (!value) {
		if (chip) {
			return (
				<span className="inline-flex items-center gap-1 px-3 py-1 border border-dashed border-ash-green text-misty-forest/70 rounded text-xs">
					+ {placeholder}
				</span>
			);
		}
		return (
			<span className="text-misty-forest/60 italic font-normal">
				{placeholder}
			</span>
		);
	}
	return <>{children}</>;
}
