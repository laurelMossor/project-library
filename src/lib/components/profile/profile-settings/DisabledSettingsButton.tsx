/**
 * Disabled button for mocked/upcoming features in profile settings
 */
export function DisabledSettingsButton({ children }: { children: React.ReactNode }) {
	return (
		<button
			disabled
			className="w-full px-4 py-2 text-left rounded border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed flex items-center justify-between"
		>
			<span>{children}</span>
			<span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Coming Soon</span>
		</button>
	);
}
