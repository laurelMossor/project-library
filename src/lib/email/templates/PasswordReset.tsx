import { Button, Heading, Link, Text } from "@react-email/components";
import { Layout, brand } from "./Layout";

interface PasswordResetProps {
	url: string;
}

export function PasswordReset({ url }: PasswordResetProps) {
	return (
		<Layout preview="Reset your Project Library password">
			<Heading style={heading}>Reset your password</Heading>
			<Text style={text}>
				We received a request to reset your Project Library password. Click
				below to choose a new one.
			</Text>
			<Button style={button} href={url}>
				Reset my password
			</Button>
			<Text style={muted}>
				This link expires in 1 hour. If the button doesn&apos;t work, paste this
				URL into your browser:
			</Text>
			<Link style={link} href={url}>
				{url}
			</Link>
			<Text style={muted}>
				If you didn&apos;t request a password reset, you can safely ignore this
				email — your password won&apos;t change.
			</Text>
		</Layout>
	);
}

const heading: React.CSSProperties = {
	color: brand.richBrown,
	fontSize: "20px",
	fontWeight: 700,
	margin: "0 0 12px",
};

const text: React.CSSProperties = {
	color: brand.richBrown,
	fontSize: "15px",
	lineHeight: "22px",
	margin: "0 0 24px",
};

const button: React.CSSProperties = {
	backgroundColor: brand.mossGreen,
	color: brand.white,
	fontSize: "15px",
	fontWeight: 600,
	borderRadius: "8px",
	padding: "12px 22px",
	textDecoration: "none",
	display: "inline-block",
};

const muted: React.CSSProperties = {
	color: brand.mistyForest,
	fontSize: "13px",
	lineHeight: "19px",
	margin: "24px 0 6px",
};

const link: React.CSSProperties = {
	color: brand.mossGreen,
	fontSize: "13px",
	wordBreak: "break-all",
};
