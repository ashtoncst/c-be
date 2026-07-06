# Email Setup Guide

All outbound email from the Converge Global site flows through one backend endpoint: `POST /api/email`. Six email types share this endpoint:

| Type | Triggered by |
|---|---|
| `contact` | `/contact-us` form submission |
| `download` | Brochure-download gating modal |
| `newsletter` | Coming Soon / newsletter signup |
| `pricing` | Pricing request modal |
| `inquiry` | MEF 3.0 "Learn More" landing-page modal |
| `sales-lead` | Cart → convert (online-selling-portal) |

The frontend's `/api/contact` route is a thin proxy that forwards to this endpoint. No email-sending logic lives in the frontend.

---

## Architecture

```
Browser form ──▶ FE /api/contact (thin proxy) ──▶ BE POST /api/email
                                                          │
                                                          ▼
                                                    EmailService
                                                          │
                                                          ▼
                                                   Mailgun SMTP (primary)
                                                          │  on any failure
                                                          ▼
                                                   Resend HTTP (fallback, optional)
```

- **Primary:** Mailgun via standard SMTP. Resilient STARTTLS on port 587 (or 2525 where 587 is blocked).
- **Fallback:** Resend HTTP API. Used automatically on any SMTP failure — purely optional. When not configured, the service runs Mailgun-only and returns an error on Mailgun outage.
- **Failure mode:** non-blocking. The service never throws; callers (including `cart.service.ts`) see a boolean return. Form submissions return `{ error: string }` with HTTP 500 on total failure.

---

## Environment variables

### Required

| Variable | Example | Description |
|---|---|---|
| `EMAIL_TRANSPORT` | `smtp` | Primary transport selector (`smtp` or `resend`) |
| `EMAIL_FROM` | `noreply@notifications.convergeict.com` | Sender address used by SMTP |
| `EMAIL_SMTP_HOST` | `smtp.eu.mailgun.org` | Mailgun SMTP relay host |
| `EMAIL_SMTP_PORT` | `587` | STARTTLS port (use `2525` if the host blocks 587) |
| `EMAIL_SMTP_USER` | `noreply@notifications.convergeict.com` | Mailgun SMTP username |
| `EMAIL_SMTP_PASSWORD` | `<Mailgun secret>` | Mailgun SMTP password |
| `EMAIL_RECIPIENT` | `sales@convergeglobal.com` | Inbox that receives all form submissions |

### Optional — Resend fallback (skip if not using)

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key. Without it, no fallback — Mailgun-only. |
| `SALES_LEAD_FROM_EMAIL` | Sender address for Resend-delivered mail. Must be a verified Resend sender. |
| `SALES_LEAD_FROM_NAME` | Display name paired with `SALES_LEAD_FROM_EMAIL`. |

### Optional — rate limit tuning

| Variable | Default | Description |
|---|---|---|
| `EMAIL_RATE_LIMIT_MAX` | `30` | Max requests per window per IP |
| `EMAIL_RATE_LIMIT_WINDOW_MS` | `900000` | Window length in milliseconds (15 min) |

### Legacy (backward-compatible)

| Variable | Status |
|---|---|
| `SALES_LEAD_RECIPIENT_EMAIL` | Still honored as a fallback for `EMAIL_RECIPIENT`. Remove once `EMAIL_RECIPIENT` is set. |

---

## Sample `.env` (production)

```
# Mailgun primary
EMAIL_TRANSPORT=smtp
EMAIL_FROM=noreply@notifications.convergeict.com
EMAIL_SMTP_HOST=smtp.eu.mailgun.org
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=noreply@notifications.convergeict.com
EMAIL_SMTP_PASSWORD=<secret>
EMAIL_RECIPIENT=sales@convergeglobal.com

# Optional: Resend fallback
# RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
# SALES_LEAD_FROM_EMAIL=noreply@convergeglobal.com
# SALES_LEAD_FROM_NAME=Converge Global

# Optional: tune rate limit
# EMAIL_RATE_LIMIT_MAX=30
# EMAIL_RATE_LIMIT_WINDOW_MS=900000
```

---

## Endpoint contract

`POST /api/email`

**Request body**

```jsonc
{
  "type": "contact | download | newsletter | pricing | inquiry | sales-lead",
  "name": "string (2-100 chars)",
  "email": "string (valid email)",
  "company": "string (2-150 chars)",
  "address": "string — required for contact + sales-lead",
  "mobile": "string — required for contact + sales-lead (phone regex)",
  "inquiry": "string (10-2000 chars) — required for contact",
  "downloadUrl": "string — required for download",
  "downloadName": "string — optional; FE-supplied brochure label",
  "selectedProducts": "array — required for sales-lead"
}
```

**Responses**

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ "success": true }` | Email queued for delivery |
| 400 | `{ "error": "<validation message>" }` | DTO rejection |
| 429 | `{ "error": "Too many requests. Please try again later." }` | Rate limit tripped |
| 500 | `{ "error": "Failed to send email..." }` | Both transports failed |

---

## Testing

### curl

```bash
# Contact
curl -X POST http://localhost:3000/api/email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "contact",
    "name": "Test User",
    "email": "test@example.com",
    "company": "Acme",
    "address": "1 Test St",
    "mobile": "+63 912 345 6789",
    "inquiry": "Interested in fiber options."
  }'

# Brochure download
curl -X POST http://localhost:3000/api/email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "download",
    "name": "Test User",
    "email": "test@example.com",
    "company": "Acme",
    "downloadUrl": "/brochures/bifrost.pdf",
    "downloadName": "Bifrost"
  }'

# Sales lead (mirrors cart → convert)
curl -X POST http://localhost:3000/api/email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sales-lead",
    "name": "Test User",
    "email": "test@example.com",
    "company": "Acme",
    "address": "1 Test St",
    "mobile": "+63 912 345 6789",
    "selectedProducts": [{"itemName": "Fiber 100", "itemType": "product"}]
  }'
```

### Via the frontend

Every form on the site routes through `FE /api/contact → BE /api/email`. The backend log stream prints one `[EmailService]` entry per delivery attempt with `transport: smtp | resend` so you can verify which path served the request.

### Fallback verification

Temporarily set `EMAIL_SMTP_HOST=smtp.invalid.local`, submit any form, and watch the logs:

```
Failed to send email via smtp (getaddrinfo ENOTFOUND smtp.invalid.local)
Primary transport failed, attempting fallback (primary: smtp, fallback: resend)
Email sent successfully (transport: resend)
```

---

## Troubleshooting

### Mailgun timeout / ECONNREFUSED on port 587

Consumer ISPs and some corporate networks block outbound SMTP on port 587. Switch to Mailgun's alternate port:

```
EMAIL_SMTP_PORT=2525
```

No other change needed.

### 429 "Too many requests"

Rate limit is 30 req / IP / 15 min by default. If legitimate traffic (e.g. office NAT) trips it, raise the limit:

```
EMAIL_RATE_LIMIT_MAX=60
```

### 400 "Name must be..." / "Please provide a valid email address..."

DTO validation failed. The response body contains the specific constraint. Check the first field mentioned and compare against the contract table above.

### 500 "Failed to send email..."

Primary transport failed AND fallback (if configured) also failed. Check the backend logs for the transport-specific error — typically a Mailgun auth/quota issue or DNS failure. Verify `EMAIL_SMTP_*` credentials and the sender domain is verified in Mailgun.

### Email goes to spam / isn't received

- Confirm the Mailgun sender domain (`notifications.convergeict.com`) has SPF + DKIM records published
- Check Mailgun's dashboard > Logs for delivery status (delivered / deferred / bounced)
- First-time sender-recipient pairs sometimes land in Promotions/Spam on first send. Mark once as not-spam.

### Legacy env still in use

If the repo is still reading `SALES_LEAD_RECIPIENT_EMAIL` instead of `EMAIL_RECIPIENT`, both are set and pointing at different inboxes, or you just migrated — the service prefers `EMAIL_RECIPIENT`. Remove the legacy var once the new one is stable.
