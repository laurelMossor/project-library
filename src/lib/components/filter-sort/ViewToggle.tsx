import { ViewType } from "@/lib/hooks/useFilter";

type ViewToggleButtonProps = {
	label: string;
	value: ViewType;
	selected: boolean;
	onClick: (value: ViewType) => void;
};

export const ViewToggleButton = ({ label, value, selected, onClick }: ViewToggleButtonProps) => {
	const bgColor = selected ? "bg-melon-green" : "bg-ash-green";
	const textColor = selected ? "text-rich-brown" : "text-dusty-grey";
	return (
		<button
			onClick={() => onClick(value)}
			className={`text-sm font-bold px-2 py-1 rounded ${bgColor} ${textColor} cursor-pointer transition-shadow hover:shadow-[0_0_12px_rgba(0,0,0,0.25)]`}
			style={{ WebkitAppearance: "none", appearance: "none", border: "none", margin: 0 }}
		>
			{label}
		</button>
	);
};

type ViewToggleProps = {
	view: ViewType;
	onViewChange: (view: ViewType) => void;
	hasLocationData?: boolean;
};

export function ViewToggle({
	view,
	onViewChange,
	hasLocationData = false,
}: ViewToggleProps) {
	return (
		<div className="flex gap-2 ml-auto">
			<ViewToggleButton
				label="Grid"
				value="grid"
				selected={view === "grid"}
				onClick={onViewChange}
			/>
			<ViewToggleButton
				label="List"
				value="list"
				selected={view === "list"}
				onClick={onViewChange}
			/>
			{hasLocationData && (
				<ViewToggleButton
					label="Map"
					value="map"
					selected={view === "map"}
					onClick={onViewChange}
				/>
			)}
		</div>
	);
}
