import { ReactNode } from "react";

type PageLayoutProps = {
	children: ReactNode;
	className?: string;
};

export function PageLayout({ children, className = "" }: PageLayoutProps) {
	return (
		<main className={`flex min-h-screen flex-col px-6 py-4 ${className}`.trim()}>
			{children}
		</main>
	);
}

