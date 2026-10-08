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
 * blank. The Optional tag steps aside when the row is hovered, where the Edit hint appears.
 */
export function FieldLabel({
	label,
	visibility,
	optional = false,
}: {
	label: string;
	visibility?: FieldVisibility;
	optional?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-2">
			<span className="text-sm font-medium text-gray-500">
				{label}
				{visibility && <VisibilityBadge visibility={visibility} />}
			</span>
			{optional && (
				<span className="text-[10px] font-bold text-dusty-grey group-hover:invisible">Optional</span>
			)}
		</div>
	);
}
