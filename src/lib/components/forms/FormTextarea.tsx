import { TextareaHTMLAttributes } from "react";

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
	error?: string;
};

export function FormTextarea({ error, className = "", ...props }: FormTextareaProps) {
	const baseClasses = "w-full border p-2 rounded";
	const errorClasses = error ? "border-red-500" : "";
	const combinedClasses = `${baseClasses} ${errorClasses} ${className}`.trim();

	return (
		<>
			<textarea className={combinedClasses} {...props} />
			{error && <p className="text-red-500 text-sm mt-1">{error}</p>}
		</>
	);
}

