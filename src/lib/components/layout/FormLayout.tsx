import { ReactNode } from "react";

type FormLayoutProps = {
	children: ReactNode;
	className?: string;
	maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
};

const maxWidthClasses = {
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-xl",
	"2xl": "max-w-2xl",
};

export function FormLayout({ children, className = "", maxWidth = "2xl" }: FormLayoutProps) {
	return (
		<main className={`flex min-h-screen items-center justify-center p-4 ${className}`.trim()}>
			<div className={`w-full ${maxWidthClasses[maxWidth]} ${className}`.trim()}>
				{children}
			</div>
		</main>
	);
}

