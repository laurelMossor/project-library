import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

// Brand palette (mirrors src/app/globals.css — email HTML needs inline hex,
// Tailwind classes don't survive email clients).
export const brand = {
	richBrown: "#291F1E",
	mossGreen: "#475841",
	melonGreen: "#C4D6B0",
	ashGreen: "#CBD2C2",
	mistyForest: "#626D5E",
	greyWhite: "#E6E8E6",
	white: "#FFFFFF",
} as const;

interface LayoutProps {
	/** Short inbox-preview snippet shown before the email is opened. */
	preview: string;
	children: ReactNode;
}

/** Shared shell for all transactional emails — wordmark header + footer. */
export function Layout({ preview, children }: LayoutProps) {
	return (
		<Html>
			<Head />
			<Preview>{preview}</Preview>
			<Body style={body}>
				<Container style={container}>
					<Section style={header}>
						<Text style={wordmark}>The Project Library</Text>
					</Section>
					<Section style={card}>{children}</Section>
					<Hr style={hr} />
					<Text style={footer}>
						The Project Library — creativity, mutuality, and lifelong learning.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

const body: React.CSSProperties = {
	backgroundColor: brand.greyWhite,
	fontFamily:
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	margin: 0,
	padding: "32px 0",
};

const container: React.CSSProperties = {
	maxWidth: "480px",
	margin: "0 auto",
	padding: "0 16px",
};

const header: React.CSSProperties = {
	padding: "8px 0 16px",
};

const wordmark: React.CSSProperties = {
	color: brand.mossGreen,
	fontSize: "18px",
	fontWeight: 700,
	letterSpacing: "0.02em",
	margin: 0,
};

const card: React.CSSProperties = {
	backgroundColor: brand.white,
	borderRadius: "10px",
	border: `1px solid ${brand.ashGreen}`,
	padding: "28px 28px 32px",
};

const hr: React.CSSProperties = {
	borderColor: brand.ashGreen,
	margin: "24px 0 12px",
};

const footer: React.CSSProperties = {
	color: brand.mistyForest,
	fontSize: "12px",
	lineHeight: "18px",
	margin: 0,
};
