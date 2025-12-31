interface TooltipProps {
	text: string;
	children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
	return (
		<div className="tooltip">
			{children}
			<span className="tooltiptext">{text}</span>
		</div>
	);
}
