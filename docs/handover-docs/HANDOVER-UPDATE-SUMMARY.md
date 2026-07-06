# Handover Documentation Update Summary

---

# Update: April 13, 2026

**Purpose:** Document all changes since the last sync (BE: Nov 2025, FE: Dec 2025) for staging deployment

---

## Changes Made

### Backend Changes

1. **Cart Email Notifications (Resend)**
   - Sales lead email notifications when a user submits their cart
   - Uses [Resend](https://resend.com) email service
   - New files: `src/services/email.service.ts`, `src/utils/ip-extractor.ts`, `src/utils/rate-limiter.ts`

2. **Database Migration**
   - New `item_feature` junction table linking items to features
   - Migration file: `migrations/0005_add_item_feature_table.sql`
   - Also included in consolidated init script: `docs/db-scripts/init-database-20260407.sql`
   - Updated schema dump: `docs/db-scripts/rds-schema-20251107-093236.sql`

3. **Chatbot Improvements**
   - Discovery flow with guided topic selection
   - Security hardening and input guardrails
   - Rate limiting and connection management
   - Knowledge base aligned with brochure source of truth

4. **Dependency Changes**
   - **Added:** `resend`, `form-data`, `mailgun.js`
   - **Removed:** `nodemailer`, `@types/nodemailer`

### Frontend Changes

1. **⚠️ BREAKING: Next.js 15 → 16 Upgrade**
   - Requires Node.js 20+
   - May require build pipeline updates
   - ESLint config updated for Next.js 16 compatibility

2. **Dockerfile Base Image Change**
   - Changed from `node:20-alpine` (Docker Hub) to `public.ecr.aws/docker/library/node:20-alpine` (ECR Public Gallery)
   - Avoids Docker Hub rate limits during CI/CD builds

3. **Contact Form Email (Resend)**
   - New Next.js API route at `/api/contact`
   - Handles 4 form types: contact inquiries, brochure downloads, newsletter signups, pricing requests
   - Uses Resend email service (same API key as backend)

4. **New Pages (~15 pages, by category)**
   - **Internet:** DIA Basic, DIA Premium, DIA Clean Pipe, DIA Bandwidth-on-Demand, Fiber Broadband, Fiber Work-from-Home, IPL-IP
   - **Satellite:** Business Continuity, Connectivity Anywhere, Rapid Deployment
   - **Transport:** GPON
   - **Other:** Our Services, Our Solution, Data Center, Coming Soon, FAQ

5. **New Components**
   - Embla carousel system (`embla-carousel`, `embla-carousel-react`, `embla-carousel-autoplay`)
   - Chat components (redesigned chatbot widget)
   - CTA modules, content cards, promo cards, custom banners

6. **SEO Additions**
   - `robots.ts` — search engine crawl rules
   - `sitemap.ts` — dynamic sitemap generation
   - `JsonLd.tsx` — structured data component
   - `error.tsx`, `not-found.tsx`, `global-error.tsx` — error boundary pages
   - New env var: `NEXT_PUBLIC_SITE_URL`

7. **Chatbot UI Redesign**
   - Redesigned widget with robot avatar
   - Session handling (clear on refresh)
   - Error recovery with toast notifications
   - Discovery-first topic buttons

8. **Design Overhaul**
   - Visual updates across all product and service pages
   - Mobile and tablet responsive fixes
   - Updated hero sections, product cards, and page layouts

9. **Dependency Changes**
   - **Added:** `embla-carousel`, `embla-carousel-autoplay`, `embla-carousel-react`, `lucide-react`, `puppeteer`, `resend`
   - **Updated:** `next` (15 → 16), `react`/`react-dom` (19.0 → 19.2), `axios`, `daisyui`, `zustand`, `socket.io-client`, `eslint`, `typescript`, and others

---

## Email Service Setup

### Backend — Cart Sales Lead Emails

When a user submits their cart, the backend sends an email notification to the sales team.

**New environment variables:**

| Variable | Purpose | Example |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | `re_xxxxxxxxxx` |
| `SALES_LEAD_RECIPIENT_EMAIL` | Who receives cart lead emails | `sales@yourcompany.com` |
| `SALES_LEAD_FROM_EMAIL` | Sender address | `noreply@yourcompany.com` |
| `SALES_LEAD_FROM_NAME` | Sender display name | `GBG Portal` |

### Frontend — Contact Form Emails

The frontend has its own Resend integration at `/api/contact` for website forms (contact, brochure download, newsletter, pricing).

**New environment variables:**

| Variable | Purpose | Example |
|---|---|---|
| `RESEND_API_KEY` | Resend API key (can share with backend) | `re_xxxxxxxxxx` |
| `RESEND_FROM_EMAIL` | Sender address for contact forms | `noreply@yourcompany.com` |
| `CONTACT_EMAIL` | Inbox for form submissions (configure to your preferred email) | `info@convergeglobal.com` |

**Note:** Both backend and frontend can use the same Resend API key. Get yours from https://resend.com/api-keys

---

## New Environment Variables (Complete List)

### Backend

Add these to your backend `.env` or ConfigMap/Secret:

```env
# Resend Email Configuration
RESEND_API_KEY=re_xxxxxxxxxx
SALES_LEAD_RECIPIENT_EMAIL=sales@yourcompany.com
SALES_LEAD_FROM_EMAIL=noreply@yourcompany.com
SALES_LEAD_FROM_NAME=GBG Portal
```

### Frontend

Add these to your frontend `.env` or build args:

```env
# Contact Form Email (server-side, not exposed to browser)
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourcompany.com
CONTACT_EMAIL=info@convergeglobal.com

# SEO (exposed to browser)
NEXT_PUBLIC_SITE_URL=https://convergeglobal.com
```

---

## Database Migration

### Option A: Incremental Migration (existing database)

If you already have a running database, run only the new migration:

```bash
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME \
  -f migrations/0005_add_item_feature_table.sql
```

This creates the `item_feature` junction table without touching existing data.

### Option B: Fresh Install (new database)

For a clean setup, use the consolidated init script which includes all tables + seed data:

```bash
psql -h YOUR_DB_HOST -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME \
  -f docs/db-scripts/init-database-20260407.sql
```

---

## Breaking Changes

| Change | Impact | Action Required |
|---|---|---|
| Next.js 15 → 16 | Build pipeline may need updates | Ensure Node.js 20+, update CI config if pinning Next.js version |
| Dockerfile base image | `node:20-alpine` → `public.ecr.aws/docker/library/node:20-alpine` | No action if building from source; update if referencing base image directly |

---

## Deployment Steps for This Update

Assumes code is already on the staging branch.

1. **Pull latest code**
   ```bash
   git pull origin staging
   ```

2. **Install dependencies (both repos)**
   ```bash
   cd converge-global-be && npm install
   cd ../converge-global-fe && npm install
   ```

3. **Run database migration**
   ```bash
   # Option A: Incremental (existing DB)
   psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME \
     -f converge-global-be/migrations/0005_add_item_feature_table.sql

   # Option B: Fresh re-seed (new/clean DB)
   psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME \
     -f converge-global-be/docs/db-scripts/init-database-20260407.sql
   ```

4. **Add new backend environment variables**
   ```bash
   # Add to .env or ConfigMap/Secret:
   RESEND_API_KEY=re_xxxxxxxxxx
   SALES_LEAD_RECIPIENT_EMAIL=sales@yourcompany.com
   SALES_LEAD_FROM_EMAIL=noreply@yourcompany.com
   SALES_LEAD_FROM_NAME=GBG Portal
   ```

5. **Add new frontend environment variables**
   ```bash
   # Add to .env or build args:
   RESEND_API_KEY=re_xxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@yourcompany.com
   CONTACT_EMAIL=info@convergeglobal.com
   NEXT_PUBLIC_SITE_URL=https://convergeglobal.com
   ```

6. **Rebuild Docker images**
   ```bash
   # Backend
   docker build -t your-registry/converge-backend:v2.0.0 converge-global-be/

   # Frontend (note: Dockerfile base image changed)
   docker build \
     --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
     --build-arg NEXT_PUBLIC_SOCKET_URL=wss://api.yourdomain.com \
     -t your-registry/converge-frontend:v2.0.0 converge-global-fe/
   ```

7. **Deploy and verify**
   - Deploy new images to your environment
   - Verify backend health: `curl http://your-backend/api/health`
   - Verify frontend loads and new pages are accessible
   - Test chatbot: send a message and verify AI response
   - Test contact form: submit a test inquiry and verify email is received

---

## Testing Checklist

- [ ] Backend health endpoint returns 200
- [ ] New pages load (spot-check a few: `/internet`, `/satellite`, `/our-services`)
- [ ] Chatbot responds to messages
- [ ] Contact form sends email (test at `/contact-us`)
- [ ] Cart submission sends sales lead email
- [ ] No console errors in frontend
- [ ] No errors in backend logs
- [ ] WebSocket connection established

---

**Prepared By:** DevOps & Backend Team
**Date:** April 13, 2026
**Status:** Ready for Client Deployment

---
---

# Previous Update: November 20, 2025

**Date:** November 20, 2025  
**Purpose:** Update documentation for client handover with on-premise database setup

---

## Changes Made

### New Documents Created

1. **`on-premise-database-setup.md`** ⭐ Main Guide
   - Complete 40+ page guide for setting up PostgreSQL on-premise
   - Installation instructions for Ubuntu, CentOS, macOS, and Docker
   - Step-by-step database setup with schema and seeding
   - Backend configuration and deployment
   - Comprehensive testing and verification section
   - Maintenance tasks (daily, weekly, monthly)
   - Extensive troubleshooting section
   - Security best practices
   - Quick reference commands

2. **`CLIENT-HANDOVER-QUICKSTART.md`** 🚀 Quick Start
   - Condensed 3-step setup guide
   - Quick command summaries
   - Common issues with immediate fixes
   - Perfect for first-time setup
   - Links to complete guide for details

3. **`env.onpremise.example`** (Root directory)
   - On-premise focused environment variable template
   - Clear comments and instructions
   - Security notes and best practices
   - Alternative to AWS-focused env.aws.example

### Updated Documents

4. **`README.md`** (Handover docs index)
   - Added prominent section for client handover use case
   - Highlighted new quick start and complete guides
   - Updated navigation for "frontend deployed" scenario
   - Added references to new documentation
   - Updated last modified dates

5. **`README.md`** (Backend root)
   - Added "Client Handover Documentation" section at top
   - Updated Quick Start with environment file choices
   - Reorganized documentation section (Client vs Dev Team)
   - Enhanced environment variables section with on-premise config
   - Clear separation of on-premise vs AWS setup

6. **`overall-architecture.md`**
   - Added "Deployment Options" section
   - Included on-premise architecture diagram
   - Clearly labeled AWS and Kubernetes options
   - Links to relevant guides for each option

7. **`db-docs.md`**
   - Updated Overview section to include deployment options
   - Added prominent on-premise option with link to new guide
   - De-emphasized AWS as the only option
   - Maintained all existing content for AWS users

---

## Target Audience

**Primary:** Clients with frontend already deployed who need to:
- Set up PostgreSQL database on their own infrastructure
- Configure and deploy the backend application
- Connect backend to existing frontend

**Secondary:** Development teams maintaining documentation

---

## Key Features of New Documentation

### Comprehensive Coverage

✅ Multiple OS installation guides (Ubuntu, CentOS, macOS, Docker)  
✅ Database user creation and security  
✅ Schema initialization with provided SQL files  
✅ Backend configuration with environment variables  
✅ Testing and verification procedures  
✅ Daily, weekly, and monthly maintenance tasks  
✅ 15+ troubleshooting scenarios with fixes  
✅ Security best practices  
✅ Quick reference commands  

### User-Friendly Approach

✅ Clear step-by-step instructions  
✅ Expected outputs for verification  
✅ Progress indicators (✅ checkboxes)  
✅ Estimated time for each section  
✅ Copy-paste ready commands  
✅ Visual diagrams  
✅ Real-world examples  

### Two Documentation Levels

1. **Quick Start**: For users who want to get running quickly
   - 3 main steps
   - Essential commands only
   - Common issues with fixes
   - ~45 minutes to complete

2. **Complete Guide**: For users who want detailed explanations
   - All installation options
   - Detailed explanations
   - Comprehensive troubleshooting
   - Reference material
   - Maintenance procedures

---

## Documentation Structure

```
docs/handover-docs/
├── CLIENT-HANDOVER-QUICKSTART.md     🚀 NEW - Start here (3-step guide)
├── on-premise-database-setup.md      📖 NEW - Complete reference
├── README.md                          ✏️ UPDATED - Added client handover section
├── overall-architecture.md            ✏️ UPDATED - Added deployment options
├── db-docs.md                         ✏️ UPDATED - Added on-premise option
├── aws-terraform-docs.md              (Existing - AWS deployments)
├── kubernetes-deployment-guide.md     (Existing - K8s deployments)
├── deployment-checklist.md            (Existing - K8s checklist)
├── kubernetes-manifests.md            (Existing - K8s YAML)
├── cicd-docs.md                       (Existing - CI/CD)
└── langchain-docs.md                  (Existing - AI features)

Backend Root:
├── README.md                          ✏️ UPDATED - Added handover section
├── env.onpremise.example              🆕 NEW - On-premise env template
└── env.aws.example                    (Existing - AWS env template)
```

---

## Navigation Paths

### For Client with Frontend Deployed

```
1. Start: Backend README.md
   ↓
2. Read: CLIENT-HANDOVER-QUICKSTART.md (45 min)
   ↓
3. Reference: on-premise-database-setup.md (as needed)
   ↓
4. Advanced: db-docs.md (optional)
```

### For AWS Deployment

```
1. Start: Handover docs README.md
   ↓
2. Read: overall-architecture.md
   ↓
3. Follow: aws-terraform-docs.md
   ↓
4. Setup: cicd-docs.md
```

### For Kubernetes Deployment

```
1. Start: Handover docs README.md
   ↓
2. Read: deployment-checklist.md
   ↓
3. Follow: kubernetes-deployment-guide.md
   ↓
4. Apply: kubernetes-manifests.md
```

---

## Content Highlights

### Installation Support

- **Ubuntu/Debian**: `apt install` method
- **CentOS/RHEL**: `dnf install` with PostgreSQL repository
- **macOS**: Homebrew installation
- **Docker**: Container-based deployment

### Database Setup

- User and database creation with proper permissions
- Schema initialization using provided SQL files
- Data seeding with product catalog
- Verification queries to confirm setup

### Backend Configuration

- Complete `.env` file template
- Explanation of each variable
- Security considerations
- Production vs development settings

### Testing Procedures

1. Backend health check endpoint
2. Database connection test
3. API documentation access
4. WebSocket connection test
5. Frontend integration test

### Maintenance Tasks

**Daily:**
- Monitor logs
- Check database connections

**Weekly:**
- Database backups
- Session cleanup verification

**Monthly:**
- Database maintenance (VACUUM, ANALYZE)
- Application updates
- Security updates

### Troubleshooting Coverage

- PostgreSQL connection issues
- Authentication failures
- Missing schema/data
- Gemini API problems
- WebSocket connection issues
- Memory and disk space issues
- Each with diagnostic commands and fixes

---

## Benefits for Client

1. **Self-Sufficient Setup**
   - Complete instructions for on-premise deployment
   - No AWS dependencies or cloud vendor lock-in
   - Full control over infrastructure

2. **Time-Efficient**
   - Quick start guide: 45 minutes
   - Copy-paste commands
   - Pre-written configurations

3. **Comprehensive Support**
   - Troubleshooting for common issues
   - Maintenance procedures
   - Security best practices

4. **Multiple Options**
   - Various OS platforms supported
   - Docker option available
   - Flexible deployment scenarios

5. **Future-Proof**
   - Maintenance procedures documented
   - Update procedures included
   - Backup and recovery covered

---

## Technical Details

### Database Version
- PostgreSQL 16.8+ (matches current RDS version)
- Compatible with provided schema files

### Backend Requirements
- Node.js 20+
- Express.js with Socket.IO
- Google Gemini API access

### System Requirements
**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB

**Recommended:**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD

---

## Files Referenced

### SQL Schema Files (Already Exist)
- `docs/db-scripts/rds-schema-20251107-093236.sql`
- `docs/db-scripts/rds-seeding-20251107-093236.sql`

These files are referenced throughout the new documentation and are essential for database initialization.

---

## Testing Performed

- ✅ Documentation structure reviewed
- ✅ Links between documents verified
- ✅ SQL commands syntax checked
- ✅ Bash commands syntax checked
- ✅ Navigation paths tested
- ✅ Cross-references validated

---

## Next Steps for Client

1. **Immediate**: Follow CLIENT-HANDOVER-QUICKSTART.md
2. **Setup Phase**: Reference on-premise-database-setup.md as needed
3. **Ongoing**: Use maintenance sections for daily/weekly/monthly tasks
4. **Issues**: Consult troubleshooting section

---

## Maintenance Notes

### For Documentation Maintainers

- Keep SQL schema file references updated if schema changes
- Update version numbers if PostgreSQL/Node.js requirements change
- Add new troubleshooting scenarios as they arise
- Update estimated times based on client feedback
- Keep security best practices current

### Review Schedule

- **Quarterly**: Review all client-facing documentation
- **After major changes**: Update affected sections
- **Before each handover**: Verify all commands and procedures

---

## Impact Summary

### Before This Update
- Documentation heavily focused on AWS deployment
- No clear path for on-premise setup
- Complex navigation for simple use case
- Frontend-already-deployed scenario not addressed

### After This Update
- ✅ Clear on-premise setup path
- ✅ Two-tier documentation (Quick + Complete)
- ✅ Frontend-deployed scenario prominently featured
- ✅ Multiple deployment options clearly presented
- ✅ Client can be self-sufficient within 45 minutes

---

**Prepared By:** DevOps & Backend Team  
**Date:** November 20, 2025  
**Status:** Ready for Client Handover

