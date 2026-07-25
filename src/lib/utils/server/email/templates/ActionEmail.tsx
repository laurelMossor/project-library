import { Button, Heading, Link, Text } from "@react-email/components";
import { Layout, brand } from "./Layout";

// Shared shape for "click this button to do a thing" transactional emails
// (verify email, reset password). The two flows differ only in copy + expiry,
// so the structure and styles live here once; VerifyEmail / PasswordReset are
// thin configs over this.
interface ActionEmailProps {
	/** Inbox-preview snippet (passed through to Layout). */
	preview: string;
	/** Big heading line. */
	title: string;
	/** Lead paragraph above the button. */
	intro: string;
	/** Call-to-action button label. */
	buttonLabel: string;
	/** Absolute action URL (button href + shown as a fallback link). */
	url: string;
	/** Expiry sentence, e.g. "This link expires in 24 hours." */
	expiryNote: string;
	/** Closing reassurance, e.g. "If you didn't request this, ignore it." */
	footnote: string;
}

export function ActionEmail({
	preview,
	title,
	intro,
	buttonLabel,
	url,
	expiryNote,
	footnote,
}: ActionEmailProps) {
	return (
		<Layout preview={preview}>
			<Heading style={heading}>{title}</Heading>
			<Text style={text}>{intro}</Text>
			<Button style={button} href={url}>
				{buttonLabel}
			</Button>
			<Text style={muted}>
				{expiryNote} If the button doesn&apos;t work, paste this URL into your
				browser:
			</Text>
			<Link style={link} href={url}>
				{url}
			</Link>
			<Text style={muted}>{footnote}</Text>
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
