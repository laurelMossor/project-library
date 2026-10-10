import { Link, Text } from "@react-email/components";
import { Layout, brand } from "./Layout";

// Shared shape for "a note from a person" emails (signup invites, page invites). No heading,
// no button, link written into the sentence: big CTA buttons and marketing-style headings are
// what push mail into Gmail's Promotions tab. Action emails (verify, reset) stay on ActionEmail.
export interface LetterEmailProps {
	/** Inbox-preview snippet (passed through to Layout). */
	preview: string;
	/** Body paragraphs, in order, above the link. */
	paragraphs: string[];
	/** Optional quoted note from the sender, shown after the paragraphs. */
	quote?: { attribution: string; text: string };
	/** Absolute action URL, written out in full. */
	url: string;
	/** Expiry sentence, e.g. "This invitation expires in 14 days." */
	expiryNote: string;
	/** Optional closing line. */
	signoff?: string;
}

export function LetterEmail({ preview, paragraphs, quote, url, expiryNote, signoff }: LetterEmailProps) {
	return (
		<Layout preview={preview} plain>
			{paragraphs.map((p, i) => (
				<Text key={i} style={text}>
					{p}
				</Text>
			))}
			{quote ? (
				<>
					<Text style={text}>{quote.attribution}</Text>
					<Text style={quoteStyle}>{quote.text}</Text>
				</>
			) : null}
			<Text style={text}>
				Sign up using this link, or paste it into your browser:{" "}
				<Link style={link} href={url}>
					{url}
				</Link>
			</Text>
			<Text style={muted}>{expiryNote}</Text>
			{signoff ? <Text style={text}>{signoff}</Text> : null}
		</Layout>
	);
}

const text: React.CSSProperties = {
	color: brand.richBrown,
	fontSize: "15px",
	lineHeight: "22px",
	margin: "0 0 16px",
};

const quoteStyle: React.CSSProperties = {
	...text,
	borderLeft: `3px solid ${brand.ashGreen}`,
	paddingLeft: "12px",
	whiteSpace: "pre-wrap",
};

const link: React.CSSProperties = {
	color: brand.mossGreen,
	wordBreak: "break-all",
};

const muted: React.CSSProperties = {
	color: brand.mistyForest,
	fontSize: "13px",
	lineHeight: "19px",
	margin: "0 0 16px",
};
