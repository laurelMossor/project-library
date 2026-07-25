type FormErrorProps = {
	error: string;
};

export function FormError({ error }: FormErrorProps) {
	if (!error) return null;
	return <p className="text-novel-red text-sm">{error}</p>;
}

