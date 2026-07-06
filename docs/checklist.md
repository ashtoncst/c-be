# GBG Website Redesign — Backend QA & UAT Checklist

**Context:** CEA/EY approved the website redesign on 2026-03-25. This checklist covers backend-specific pre-go-live QA, UAT preparation, and turnover tasks.

---

## 1. CMS & Content Data

- [ ] All CMS content entries are finalized (no draft/test content)
- [ ] Product/service data is accurate and complete
- [ ] API responses return correct copy and content
- [ ] Image CDN / asset pipeline serves correct assets

---

## 2. Core Functions — Contact Form

- [ ] Contact form submissions are received and stored
- [ ] Form data validation (required fields, email format, phone format)
- [ ] Rate limiting on form submissions to prevent spam

---

## 3. Transactional Flows — eBrochure Downloads

- [ ] eBrochure files uploaded and accessible at correct URLs
- [ ] Download endpoints return correct files with proper headers
- [ ] Download tracking/analytics events fire correctly
- [ ] File storage and CDN configured for production load

---

## 4. User Roles & CMS Access

- [ ] Admin role: full CMS access (create, edit, delete, publish)
- [ ] Editor role: content editing without publish/delete permissions
- [ ] Public user: read-only, no CMS access
- [ ] Role-based access controls enforced on all CMS endpoints
- [ ] Login/authentication flow works correctly
- [ ] Session management and logout work properly
- [ ] Access levels documented for Converge IT handover

---

## 5. Performance & Load (with Converge IT)

- [ ] API response times < 500ms under normal load
- [ ] Load testing completed (expected concurrent users)
- [ ] Database queries optimized (no N+1, proper indexes)
- [ ] Caching strategy in place (CDN, API cache)
- [ ] Server error rate < 1% under load
- [ ] WebSocket connections stable under concurrent load (chatbot)

---

## 6. Security & Compliance (with Converge IT)

- [ ] SSL/TLS certificate installed and valid
- [ ] HTTP to HTTPS redirect enforced
- [ ] CORS configured for allowed origins only
- [ ] API endpoints protected against injection (SQL, NoSQL)
- [ ] Rate limiting on public endpoints
- [ ] Secure headers (X-Frame-Options, X-Content-Type-Options, HSTS)
- [ ] Environment variables / secrets not exposed in responses
- [ ] File upload validation (if applicable) — type, size limits

---

## 7. Integration — Outbound Email

All site email (contact, brochure download, newsletter, pricing, inquiry, sales-lead) routes through a single backend endpoint `POST /api/email` via Mailgun SMTP with optional Resend fallback. See `docs/email-setup.md` for full configuration.

- [ ] `EMAIL_TRANSPORT`, `EMAIL_SMTP_*`, `EMAIL_FROM`, `EMAIL_RECIPIENT` set in production env
- [ ] Mailgun sender domain (`notifications.convergeict.com`) has valid SPF + DKIM records
- [ ] Each of the six email types delivers in staging (see verification steps in `email-setup.md`)
- [ ] Rate limit (`EMAIL_RATE_LIMIT_MAX`, default 30/IP/15min) tuned for expected traffic
- [ ] Email template renders customer fields, brochure name (for download), and product list (for sales-lead)
- [ ] Sender address and reply-to are correct
- [ ] Email delivery tested (check spam/junk folder)
- [ ] `RESEND_API_KEY` and fallback envs configured only if redundancy is wanted — optional

---

## 8. Analytics & Tracking (with Converge IT)

- [ ] Server-side analytics events fire correctly (if applicable)
- [ ] Conversion/goal tracking endpoints functional

---

## 9. Error Handling

- [ ] 404 responses for unknown routes (JSON for API, page for browser)
- [ ] 500 errors return generic message (no stack traces in production)
- [ ] Input validation returns 400 with descriptive error messages
- [ ] Error logging configured (structured logs, no PII in logs)
- [ ] Unhandled exception catcher to prevent server crashes

---

## 10. Chatbot Backend

- [ ] WebSocket connection establishes and maintains stability
- [ ] AI responses stream correctly via Socket.IO
- [ ] Conversation history persists to database
- [ ] Session recovery works (close browser, reopen)
- [ ] Request deduplication (2s window) prevents double responses
- [ ] Fallback to keyword matching when Gemini API is unavailable
- [ ] Intent classification handles typos and variations

Refer to `chatbot-specs-and-uat.md` (root) for full chatbot UAT scenarios (36 test cases).

---

## 11. Deployment & Turnover Readiness

- [ ] Production build completes without errors
- [ ] Database migrations are up to date
- [ ] Environment variables documented for Converge IT
- [ ] API documentation provided (endpoints, auth, payloads)
- [ ] CMS admin guide prepared for Converge IT
- [ ] Deployment process documented (CI/CD or manual steps)
- [ ] Backup/restore procedure documented
- [ ] Monitoring/alerting configured

---

## 12. UAT Sign-off

- [ ] All sections above completed and passing
- [ ] UAT scenarios executed and documented by Converge IT
- [ ] All critical/high bugs resolved
- [ ] Medium/low bugs triaged (fix now vs. post-launch)
- [ ] Performance benchmarks met
- [ ] Security review completed with Converge IT
- [ ] Email hand-off to Global Business mailbox confirmed working
- [ ] CMS access levels confirmed by Converge IT
- [ ] Deployment runbook reviewed and approved
- [ ] Rollback plan documented
