import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	fullWidth?: boolean;
	loading?: boolean;
	children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
	primary: "bg-rich-brown text-grey-white hover:bg-muted-brown",
	secondary: "border border-soft-grey hover:bg-grey-white",
	tertiary: "text-rich-brown hover:bg-grey-white",
	danger: "bg-alert-red text-grey-white hover:bg-novel-red",
};

const sizeClasses: Record<ButtonSize, string> = {
	sm: "px-3 py-1.5 text-sm",
	md: "px-4 py-2",
	lg: "px-6 py-3 text-lg",
};

export function Button({
	variant = "primary",
	size = "md",
	fullWidth = false,
	loading = false,
	disabled,
	className = "",
	children,
	...props
}: ButtonProps) {
	const baseClasses = "rounded transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed";
	const variantClass = variantClasses[variant];
	const sizeClass = sizeClasses[size];
	const widthClass = fullWidth ? "w-full" : "";
	const loadingClass = loading ? "cursor-wait" : "";

	const combinedClasses = `${baseClasses} ${variantClass} ${sizeClass} ${widthClass} ${loadingClass} ${className}`.trim();

	return (
		<button
			className={combinedClasses}
			disabled={disabled || loading}
			{...props}
		>
			{loading ? "Loading..." : children}
		</button>
	);
}

