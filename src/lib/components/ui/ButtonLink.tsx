import Link from "next/link";
import { ComponentProps } from "react";
import { Button } from "./Button";

type ButtonLinkProps = ComponentProps<typeof Link> & {
	variant?: "primary" | "secondary" | "tertiary" | "danger";
	size?: "sm" | "md" | "lg";
	fullWidth?: boolean;
};

// TODO: Refactor these into theme styles or remove
export function ButtonLink({
	variant = "primary",
	size = "md",
	fullWidth = false,
	className = "",
	children,
	...linkProps
}: ButtonLinkProps) {
	const baseClasses = "rounded transition-colors font-medium inline-block text-center";
	const variantClasses = {
		primary: "bg-black text-white hover:bg-gray-800",
		secondary: "border border-gray-300 hover:bg-gray-50",
		tertiary: "text-black hover:bg-gray-100",
		danger: "bg-alert-red text-white hover:bg-novel-red",
	};
	const sizeClasses = {
		sm: "px-3 py-1.5 text-sm",
		md: "px-4 py-2",
		lg: "px-6 py-3 text-lg",
	};
	const widthClass = fullWidth ? "w-full" : "";

	const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`.trim();

	return (
		<Link className={combinedClasses} {...linkProps}>
			{children}
		</Link>
	);
}

