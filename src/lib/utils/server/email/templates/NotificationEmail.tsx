import { Column, Hr, Img, Link, Row, Section, Text } from "@react-email/components";
import { Layout, brand } from "./Layout";

/** One notification line within a profile section. */
export interface EmailNotificationRow {
	/** Human copy from the shared notificationText builder. */
	text: string;
	/** Absolute deep link to the object. */
	href: string;
}

/** One profile's section — a header identifying the identity, then its notification rows. */
export interface EmailProfileSection {
	/** "Personal" or the page name. */
	name: string;
	handle?: string | null;
	/** Absolute avatar URL; when absent the initial is shown in a coloured cell. */
	avatarUrl?: string | null;
	/** Single-letter fallback for the avatar. */
	initial: string;
	/** Per-section one-click unsubscribe (targets this identity's master). */
	unsubscribeUrl: string;
	rows: EmailNotificationRow[];
}

export interface NotificationEmailProps {
	sections: EmailProfileSection[];
	/** Footer "Manage email preferences" link → /settings/notifications. */
	managePrefsUrl: string;
	/** Inbox preview snippet; defaults to the first row. */
	preview?: string;
}

/**
 * The grouped activity/message email. Body is a table grouped by identity: each profile the email
 * concerns gets a header (email-safe ProfileTag + its own unsubscribe link) followed by one row per
 * notification. A single per-event send renders one section with one row; the flush's coalescing is
 * what populates multiple rows / sections.
 */
export function NotificationEmail({ sections, managePrefsUrl, preview }: NotificationEmailProps) {
	const previewText = preview ?? sections[0]?.rows[0]?.text ?? "New activity on The Project Library";
	return (
		<Layout preview={previewText} managePrefsUrl={managePrefsUrl}>
			{sections.map((section, i) => (
				<Section key={i} style={i > 0 ? sectionSpaced : undefined}>
					{i > 0 ? <Hr style={sectionRule} /> : null}
					<Row>
						<Column style={avatarCell}>
							{section.avatarUrl ? (
								<Img src={section.avatarUrl} width="36" height="36" alt="" style={avatarImg} />
							) : (
								<Text style={avatarInitial}>{section.initial}</Text>
							)}
						</Column>
						<Column>
							<Text style={profileName}>{section.name}</Text>
							{section.handle ? <Text style={profileHandle}>@{section.handle}</Text> : null}
						</Column>
					</Row>

					{section.rows.map((row, j) => (
						<Text key={j} style={rowText}>
							<Link href={row.href} style={rowLink}>
								{row.text}
							</Link>
						</Text>
					))}

					<Text style={unsubLine}>
						<Link href={section.unsubscribeUrl} style={unsubLink}>
							Unsubscribe {section.name} from these emails
						</Link>
					</Text>
				</Section>
			))}
		</Layout>
	);
}

const sectionSpaced: React.CSSProperties = { marginTop: "8px" };

const sectionRule: React.CSSProperties = {
	borderColor: brand.ashGreen,
	margin: "20px 0",
};

const avatarCell: React.CSSProperties = {
	width: "48px",
	verticalAlign: "top",
};

const avatarImg: React.CSSProperties = {
	borderRadius: "18px",
	display: "block",
};

const avatarInitial: React.CSSProperties = {
	backgroundColor: brand.melonGreen,
	color: brand.richBrown,
	width: "36px",
	height: "36px",
	borderRadius: "18px",
	textAlign: "center",
	lineHeight: "36px",
	fontSize: "16px",
	fontWeight: 700,
	margin: 0,
};

const profileName: React.CSSProperties = {
	color: brand.richBrown,
	fontSize: "15px",
	fontWeight: 700,
	margin: 0,
};

const profileHandle: React.CSSProperties = {
	color: brand.mistyForest,
	fontSize: "13px",
	margin: 0,
};

const rowText: React.CSSProperties = {
	margin: "12px 0 0",
	fontSize: "14px",
	lineHeight: "20px",
};

const rowLink: React.CSSProperties = {
	color: brand.richBrown,
	textDecoration: "none",
};

const unsubLine: React.CSSProperties = {
	margin: "12px 0 0",
	fontSize: "12px",
};

const unsubLink: React.CSSProperties = {
	color: brand.mistyForest,
	textDecoration: "underline",
};
