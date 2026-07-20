import { ReactNode } from "react";

type FormFieldProps = {
	label: string;
	htmlFor?: string;
	required?: boolean;
	children: ReactNode;
	helpText?: string;
};

export function FormField({ label, htmlFor, required = false, children, helpText }: FormFieldProps) {
	return (
		<div>
			<label htmlFor={htmlFor} className="block text-sm font-medium mb-1">
				{label} {required && <span className="text-novel-red">*</span>}
			</label>
			{children}
			{helpText && <p className="text-xs text-misty-forest mt-1">{helpText}</p>}
		</div>
	);
}

