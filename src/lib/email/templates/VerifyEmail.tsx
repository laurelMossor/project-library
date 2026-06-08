import { Button, Heading, Link, Text } from "@react-email/components";
import { Layout, brand } from "./Layout";

interface VerifyEmailProps {
	url: string;
}

export function VerifyEmail({ url }: VerifyEmailProps) {
	return (
		<Layout preview="Confirm your email to finish setting up your account">
			<Heading style={heading}>Confirm your email</Heading>
			<Text style={text}>
				Welcome to The Project Library. Confirm your email address to activate
				your account and start sharing what you&apos;re making.
			</Text>
			<Button style={button} href={url}>
				Verify my email
			</Button>
			<Text style={muted}>
				This link expires in 24 hours. If the button doesn&apos;t work, paste
				this URL into your browser:
			</Text>
			<Link style={link} href={url}>
				{url}
			</Link>
			<Text style={muted}>
				If you didn&apos;t create an account, you can safely ignore this email.
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
