interface TooltipProps {
	text: string;
	children: React.ReactNode;
	className?: string;
}

export function Tooltip({ text, children, className = "" }: TooltipProps) {
	return (
		<div className={`tooltip ${className}`}>
			{children}
			<span className="tooltiptext">{text}</span>
		</div>
	);
}
