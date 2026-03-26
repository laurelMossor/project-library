import { ReactNode } from "react";

type SettingsSectionProps = {
	title?: string;
	titleIcon?: ReactNode;
	children: ReactNode;
	className?: string;
};

/**
 * White box wrapper for settings sections
 */
export function SettingsSection({ title, titleIcon, children, className = "" }: SettingsSectionProps) {
	return (
		<div className={`bg-white border rounded-lg p-6 mb-6 ${className}`}>
			{title && (
				<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
					{titleIcon}
					{title}
				</h2>
			)}
			{children}
		</div>
	);
}
