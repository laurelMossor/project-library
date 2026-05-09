# WhatsApp Event Ingestion Pipeline

## Overview

A lightweight pipeline that lets an admin send event details (text and/or flyer images) to a WhatsApp number, which are automatically parsed by Claude and created as event posts in Project Library.

## Problem

Manually entering event details into PL is friction-heavy, especially when the information already exists in a flyer image or a quick text message. A WhatsApp-based intake removes that friction — snap a flyer or type the basics, and the event gets created.

## Scope

- Single admin user (you)
- Inbound messages only — no broadcast/marketing
- Text messages, image messages, or both
- One new API route on the existing PL server

---

## Architecture

```
Phone (WhatsApp)
    │
    ▼
Meta Cloud API ──webhook POST──▶ PL Server: /api/webhooks/whatsapp
                                      │
                                      ├─ Download image (if any) from Meta media endpoint
                                      │
                                      ├─ Call Claude API (text + vision)
                                      │    → Returns structured event JSON
                                      │
                                      ├─ (Optional) Reply on WhatsApp with preview for confirmation
                                      │
                                      └─ Write event to PL database + upload image to storage
```

---

## Components

### 1. WhatsApp Business Setup (Meta Cloud API)

**What you need:**

- Meta Business account (free)
- App in Meta Developer console with WhatsApp product enabled
- A registered phone number (can use Meta's test number initially)
- Webhook URL pointed at your PL server

**Environment variables:**

```
WHATSAPP_VERIFY_TOKEN=<random string you choose for webhook verification>
WHATSAPP_ACCESS_TOKEN=<from Meta Developer console>
WHATSAPP_PHONE_NUMBER_ID=<your registered number's ID>
ANTHROPIC_API_KEY=<from Anthropic console>
```

**Cost:** Free tier covers 1,000 service conversations/month. You won't come close.

### 2. Webhook Endpoint

**Route:** `POST /api/webhooks/whatsapp`

**Also needed:** `GET /api/webhooks/whatsapp` for Meta's one-time verification handshake.

**Verification handler (GET):**

```js
// Meta sends a GET to verify your webhook during setup
if (req.query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN) {
  return res.send(req.query["hub.challenge"]);
}
return res.sendStatus(403);
```

**Message handler (POST):**

```js
// Pseudocode for the main handler
async function handleWhatsAppWebhook(req, res) {
  // 1. Acknowledge immediately (Meta requires 200 within 5s)
  res.sendStatus(200);

  // 2. Extract message from webhook payload
  const message = extractMessage(req.body);
  if (!message) return;

  // 3. Collect inputs
  const text = message.text?.body || "";
  let imageBase64 = null;

  if (message.type === "image") {
    imageBase64 = await downloadWhatsAppMedia(message.image.id);
  }

  // 4. Parse with Claude
  const eventData = await parseEventWithClaude(text, imageBase64);

  // 5. Optional: send preview back for confirmation
  await sendWhatsAppReply(message.from, formatPreview(eventData));

  // 6. Create event in PL database
  await createEvent(eventData);
}
```

### 3. Media Download

WhatsApp doesn't send images inline — it sends a media ID. You need two API calls:

```js
async function downloadWhatsAppMedia(mediaId) {
  // Step 1: Get the media URL
  const urlRes = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
  );
  const { url } = await urlRes.json();

  // Step 2: Download the actual file
  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
  });
  const buffer = await mediaRes.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}
```

### 4. Claude API — Event Parsing

```js
async function parseEventWithClaude(text, imageBase64) {
  const content = [];

  if (imageBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: imageBase64,
      },
    });
  }

  content.push({
    type: "text",
    text: text
      ? `Extract event details from this message and any attached image:\n\n${text}`
      : "Extract event details from this flyer image.",
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are an event data extractor for a community platform.
Extract the following from the user's message and/or image:

Return ONLY valid JSON with these fields:
{
  "title": "string",
  "description": "string (a short, natural description of the event)",
  "date": "ISO 8601 datetime string, or null if unclear",
  "end_date": "ISO 8601 datetime string, or null",
  "location": "string, or null",
  "location_address": "string (full address if available), or null",
  "tags": ["array", "of", "relevant", "tags"],
  "confidence": "high | medium | low"
}

If the year is not specified, assume the next upcoming occurrence.
If information is ambiguous, use your best guess and set confidence accordingly.`,
      messages: [{ role: "user", content }],
    }),
  });

  const data = await response.json();
  const text_response = data.content[0].text;
  return JSON.parse(text_response.replace(/```json|```/g, "").trim());
}
```

### 5. Confirmation Reply (Optional but Recommended)

Before writing to the DB, reply on WhatsApp with a formatted preview:

```js
async function sendWhatsAppReply(to, message) {
  await fetch(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    }
  );
}

function formatPreview(event) {
  return [
    `📅 *${event.title}*`,
    event.date ? `🕐 ${new Date(event.date).toLocaleString()}` : "🕐 No date found",
    event.location ? `📍 ${event.location}` : "",
    `\n${event.description}`,
    `\nConfidence: ${event.confidence}`,
    `\nReply ✅ to post, or send corrections.`,
  ].filter(Boolean).join("\n");
}
```

**Confirmation flow (future enhancement):** Track a pending state so that the event only publishes when you reply with ✅. For v1, you could skip this and just auto-post, reviewing in PL's admin UI if needed.

### 6. Database Write

Use your existing PL event creation logic — this step is just calling whatever `createEvent` function or ORM method you already have, passing in the parsed fields plus the downloaded image.

---

## Security

- **Webhook signature verification:** Meta signs webhook payloads with your app secret. Validate the `X-Hub-Signature-256` header before processing. This prevents spoofed requests.
- **Sender allowlist:** Only process messages from your phone number. Drop everything else.

```js
const ALLOWED_SENDERS = [process.env.MY_PHONE_NUMBER];

if (!ALLOWED_SENDERS.includes(message.from)) {
  console.log("Ignored message from unknown sender");
  return;
}
```

---

## Implementation Plan

### Phase 1 — MVP (~2-3 hours)

- [ ] Create Meta Business account and app
- [ ] Register WhatsApp number (or use test number)
- [ ] Add `POST/GET /api/webhooks/whatsapp` route to PL server
- [ ] Implement Claude API call for text-only parsing
- [ ] Write parsed event to DB
- [ ] Deploy and configure webhook URL in Meta console

### Phase 2 — Images + Polish (~1-2 hours)

- [ ] Add media download from WhatsApp
- [ ] Add image support to Claude API call (vision)
- [ ] Upload event image to PL storage
- [ ] Add webhook signature verification
- [ ] Add sender allowlist

### Phase 3 — Confirmation Flow (~1 hour)

- [ ] Reply with formatted preview after parsing
- [ ] Track pending events awaiting confirmation
- [ ] Handle ✅ reply to publish, corrections to re-parse

---

## Cost Estimate

| Component | Cost |
|---|---|
| WhatsApp Business API | Free (under 1k conversations/month) |
| Claude API (Sonnet, ~1k tokens + image per event) | ~$0.01–0.03 per event |
| Hosting | Already covered by PL server |
| **Monthly estimate (50 events)** | **< $2** |

---

## Dependencies

- Anthropic API key (new)
- Meta Business account + WhatsApp Business app (new)
- Existing PL server, database, and event creation logic

---

## Alternatives Considered

**Twilio WhatsApp API:** Easier sandbox setup for prototyping, but costs $0.005+ per message and adds a vendor dependency. Meta's direct API is free and removes the middleman. Twilio is a good fallback if Meta's approval process is frustrating.

**Telegram Bot API:** Significantly easier setup (no business verification, instant bot creation via BotFather). Worth considering if WhatsApp's Meta Business overhead feels like too much. The trade-off is that you'd need to send events via Telegram instead of WhatsApp.

**Email-based ingestion:** Forward flyers to a dedicated email address, parse with Claude. Simpler auth story but worse UX — WhatsApp is where event flyers naturally live.