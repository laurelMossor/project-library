import { InputHTMLAttributes } from "react";

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
	error?: string;
};

export function FormInput({ error, className = "", ...props }: FormInputProps) {
	const baseClasses = "w-full border p-2 rounded";
	const errorClasses = error ? "border-red-500" : "";
	const combinedClasses = `${baseClasses} ${errorClasses} ${className}`.trim();

	return (
		<>
			<input className={combinedClasses} {...props} />
			{error && <p className="text-red-500 text-sm mt-1">{error}</p>}
		</>
	);
}

