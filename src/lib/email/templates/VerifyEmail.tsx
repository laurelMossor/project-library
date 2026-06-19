import { ActionEmail } from "./ActionEmail";

interface VerifyEmailProps {
	url: string;
}

export function VerifyEmail({ url }: VerifyEmailProps) {
	return (
		<ActionEmail
			preview="Confirm your email to finish setting up your account"
			title="Confirm your email"
			intro="Welcome to The Project Library. Confirm your email address to activate your account and start sharing what you're making."
			buttonLabel="Verify my email"
			url={url}
			expiryNote="This link expires in 24 hours."
			footnote="If you didn't create an account, you can safely ignore this email."
		/>
	);
}
