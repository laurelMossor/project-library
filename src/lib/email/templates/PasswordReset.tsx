import { ActionEmail } from "./ActionEmail";

interface PasswordResetProps {
	url: string;
}

export function PasswordReset({ url }: PasswordResetProps) {
	return (
		<ActionEmail
			preview="Reset your Project Library password"
			title="Reset your password"
			intro="We received a request to reset your Project Library password. Click below to choose a new one."
			buttonLabel="Reset my password"
			url={url}
			expiryNote="This link expires in 1 hour."
			footnote="If you didn't request a password reset, you can safely ignore this email — your password won't change."
		/>
	);
}
