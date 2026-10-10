import { EyeIcon, EyeOffIcon } from "@/lib/components/icons/icons";

export type FieldVisibility = "public" | "private";

function VisibilityBadge({ visibility }: { visibility: FieldVisibility }) {
	const Icon = visibility === "public" ? EyeIcon : EyeOffIcon;
	return (
		<span className="inline-flex items-center gap-1 text-xs text-dusty-grey ml-2">
			<Icon className="w-3 h-3" />
			{visibility === "public" ? "Public" : "Private"}
		</span>
	);
}

/**
 * A field's label row: the name, who can see it, and (at the far right) whether it can be left
 * blank. The Optional or Required tag steps aside when the row is hovered, where the Edit hint appears.
 */
export function FieldLabel({
	label,
	visibility,
	optional = false,
	required = false,
	htmlFor,
}: {
	label: string;
	visibility?: FieldVisibility;
	optional?: boolean;
	required?: boolean;
	/** Makes the name a real <label> for that input. */
	htmlFor?: string;
}) {
	const tag = required ? "Required" : optional ? "Optional" : null;
	return (
		<div className="flex items-center justify-between gap-2">
			<span className="text-sm font-medium text-gray-500">
				{htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
				{visibility && <VisibilityBadge visibility={visibility} />}
			</span>
			{tag && (
				<span className="text-[10px] font-bold text-dusty-grey group-hover:invisible">{tag}</span>
			)}
		</div>
	);
}
