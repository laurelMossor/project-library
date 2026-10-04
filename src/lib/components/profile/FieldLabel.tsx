import { EyeIcon } from "@/lib/components/icons/icons";

function PublicBadge() {
	return (
		<span className="inline-flex items-center gap-1 text-xs text-dusty-grey ml-2">
			<EyeIcon className="w-3 h-3" />
			Public
		</span>
	);
}

export function FieldLabel({ label, isPublic = false }: { label: string; isPublic?: boolean }) {
	return (
		<span className="text-sm font-medium text-gray-500">
			{label}
			{isPublic && <PublicBadge />}
		</span>
	);
}
