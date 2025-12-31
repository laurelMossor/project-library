import { ReactNode } from "react";

type CenteredLayoutProps = {
	children: ReactNode;
	className?: string;
	maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "6xl";
};

const maxWidthClasses = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-xl",
	"2xl": "max-w-2xl",
	"3xl": "max-w-3xl",
	"4xl": "max-w-4xl",
	"6xl": "max-w-6xl",
};

export function CenteredLayout({ children, className = "", maxWidth = "2xl" }: CenteredLayoutProps) {
	return (
		<main className={`flex min-h-screen flex-col items-center justify-center p-8 ${className}`.trim()}>
			<div className={`w-full ${maxWidthClasses[maxWidth]} ${className}`.trim()}>
				{children}
			</div>
		</main>
	);
}

