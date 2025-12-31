type FormErrorProps = {
	error: string;
};

export function FormError({ error }: FormErrorProps) {
	if (!error) return null;
	return <p className="text-red-500 text-sm">{error}</p>;
}

