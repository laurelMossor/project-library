/**
 * Throwaway local preview for the invite email. Renders InviteEmail to HTML and
 * serves it on http://localhost:3999. Run with `tsx watch` so editing the
 * template auto-restarts the server — just refresh the browser to see changes.
 *
 *   npx tsx watch scripts/preview-email.tsx
 *
 * Pure render — no DB, no send, no env needed. Safe to delete; dev-only.
 */
import { createServer } from "node:http";
import { render } from "@react-email/components";
import { InviteEmail } from "@/lib/utils/server/email/templates/InviteEmail";

const PORT = 3999;
const SAMPLE_URL =
	"https://www.theprojectlibrary.com/signup?invite=PREVIEW_TOKEN_1234567890";

createServer(async (req, res) => {
	if (req.url === "/favicon.ico") {
		res.statusCode = 204;
		return res.end();
	}
	try {
		const html = await render(InviteEmail({ url: SAMPLE_URL, expiresInDays: 14 }));
		res.setHeader("content-type", "text/html; charset=utf-8");
		res.end(html);
	} catch (err) {
		res.statusCode = 500;
		res.setHeader("content-type", "text/plain; charset=utf-8");
		res.end(String(err instanceof Error ? err.stack : err));
	}
}).listen(PORT, () => {
	console.log(`Invite email preview → http://localhost:${PORT}`);
});
