# Client Handover - Quick Start Guide

**Last Updated:** April 13, 2026

---

## Welcome! 👋

This quick start guide will help you get the Converge Global Backend up and running with your existing frontend deployment.

---

## Updating an Existing Deployment (April 2026)

If you already have a running deployment and are updating to the latest code, follow these steps:

### ⚠️ Breaking Changes

- **Frontend upgraded from Next.js 15 to Next.js 16** — ensure Node.js 20+ is installed
- **Frontend Dockerfile base image changed** to `public.ecr.aws/docker/library/node:20-alpine` (from Docker Hub)

### Update Steps

```bash
# 1. Pull latest code
cd converge-global-be && git pull origin staging
cd ../converge-global-fe && git pull origin staging

# 2. Install dependencies (both repos have changes)
cd converge-global-be && npm install
cd ../converge-global-fe && npm install

# 3. Run database migration (adds item_feature table)
# Option A: Incremental (keeps existing data)
psql -h YOUR_DB_HOST -U converge_user -d converge_db \
  -f converge-global-be/migrations/0005_add_item_feature_table.sql

# Option B: Fresh re-seed (clean database)
psql -h YOUR_DB_HOST -U converge_user -d converge_db \
  -f converge-global-be/docs/db-scripts/init-database-20260407.sql

# 4. Add new backend env vars (see below)
# 5. Add new frontend env vars (see below)

# 6. Rebuild and deploy
npm run build   # in both repos
# Or rebuild Docker images (see deployment-checklist.md)
```

### New Backend Environment Variables

Add these to your backend `.env`:

```env
# Resend Email — Cart Sales Lead Notifications
# Get your API key from: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxx
SALES_LEAD_RECIPIENT_EMAIL=sales@yourcompany.com
SALES_LEAD_FROM_EMAIL=noreply@yourcompany.com
SALES_LEAD_FROM_NAME=GBG Portal
```

### New Frontend Environment Variables

Add these to your frontend `.env`:

```env
# Contact Form Email (server-side)
# Can use the same Resend API key as backend
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourcompany.com
CONTACT_EMAIL=info@yourcompany.com  # Where contact form submissions go

# SEO
NEXT_PUBLIC_SITE_URL=https://convergeglobal.com
```

### Verify Update

```bash
# Backend health
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Check new table exists
psql -h YOUR_DB_HOST -U converge_user -d converge_db \
  -c "SELECT COUNT(*) FROM item_feature;"

# Check frontend loads
# Open browser → verify new pages load (e.g. /our-services, /contact-us)
# Test chatbot → send a message → verify AI response
```

---

## What You Need

Before starting, make sure you have:

✅ **Frontend already deployed** (Next.js application)  
✅ **Server with Linux/macOS** (for database and backend)  
✅ **Basic terminal/command line knowledge**  
✅ **Resend API key** for email notifications (get from https://resend.com/api-keys)  
✅ **About 45 minutes** for setup

---

## 3-Step Setup Process

### Step 1: Set Up Database (20 minutes)

Install and configure PostgreSQL on your server.

**👉 [Complete Database Setup Guide](./on-premise-database-setup.md#installation-options)**

**Quick Summary:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql
CREATE USER converge_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE converge_db OWNER converge_user;
\q

# Initialize schema and seed data (single command)
cd converge-global-be
psql -h localhost -U converge_user -d converge_db \
  -f docs/db-scripts/init-database-20260407.sql
```

### Step 2: Configure Backend (10 minutes)

Set up the backend application to connect to your database.

**👉 [Backend Configuration Guide](./on-premise-database-setup.md#backend-configuration)**

**Quick Summary:**
```bash
# Install dependencies
cd converge-global-be
npm install

# Create configuration
cp env.onpremise.example .env

# Edit .env with your values
nano .env
# Update:
# - DB_PASSWORD (from Step 1)
# - GOOGLE_GEMINI_API_KEY (get from https://ai.google.dev/)
# - CORS_ORIGIN (your frontend URL)
# - RESEND_API_KEY (get from https://resend.com/api-keys)
# - SALES_LEAD_RECIPIENT_EMAIL (your sales team email)
# - SALES_LEAD_FROM_EMAIL (sender address)
# - SALES_LEAD_FROM_NAME (sender display name)

# Build and start
npm run build
npm start

# Or use PM2 (recommended for production)
npm install -g pm2
pm2 start dist/index.js --name converge-backend
pm2 save
```

### Step 3: Connect Frontend (15 minutes)

Update your frontend to connect to the backend.

**Quick Summary:**

1. **Update frontend environment variables:**
   ```bash
   # In your frontend .env or config
   NEXT_PUBLIC_API_URL=http://your-backend-server:3000
   NEXT_PUBLIC_SOCKET_URL=ws://your-backend-server:3000
   ```

2. **For HTTPS (production):**
   - Set up reverse proxy (Nginx) with SSL
   - Use `https://` and `wss://` URLs

3. **Test connection:**
   - Open your frontend
   - Navigate to AI Assistant / Chat
   - Send a test message
   - Verify you receive an AI response

---

## Verify Everything Works

Run these quick checks:

```bash
# 1. Check backend health
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}

# 2. Check database connection
psql -h localhost -U converge_user -d converge_db -c "SELECT COUNT(*) FROM item;"
# Expected: ~1044 items

# 3. Check backend logs
pm2 logs converge-backend
# Should show "Server is running" and "Connected to database"
```

---

## Common Issues & Quick Fixes

### Issue: Backend can't connect to database

**Error:** `ECONNREFUSED` or `authentication failed`

**Fix:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U converge_user -d converge_db

# If password error, reset it:
sudo -u postgres psql
ALTER USER converge_user WITH PASSWORD 'new_password';
\q

# Update .env with new password
```

### Issue: Frontend can't reach backend

**Error:** Network error, 404, or CORS error

**Fix:**
1. Check backend is running: `pm2 status`
2. Verify CORS_ORIGIN in `.env` matches frontend URL exactly
3. Check firewall allows port 3000
4. Test from frontend server: `curl http://backend-ip:3000/api/health`

### Issue: AI chatbot not responding

**Error:** Failed to generate response

**Fix:**
1. Check GOOGLE_GEMINI_API_KEY in `.env`
2. Verify API key at https://ai.google.dev/
3. Ensure backend has internet access
4. Check logs: `pm2 logs converge-backend`

---

## Next Steps

### Optional Enhancements

1. **Set up HTTPS** (recommended for production)
   - Use Nginx as reverse proxy
   - Get SSL certificate from Let's Encrypt
   - Update frontend URLs to use `https://` and `wss://`

2. **Enable Auto-Start** (recommended)
   ```bash
   pm2 startup
   # Follow the instructions shown
   pm2 save
   ```

3. **Set up Automated Backups**
   ```bash
   # Create backup script
   # See: docs/handover-docs/on-premise-database-setup.md#backup-strategy
   ```

4. **Monitor System**
   - Check logs regularly: `pm2 logs`
   - Monitor disk space: `df -h`
   - Check database size: See maintenance section

---

## Complete Documentation

For detailed information on any topic:

- **[Complete On-Premise Setup Guide](./on-premise-database-setup.md)** - Full walkthrough
- **[Database Documentation](./db-docs.md)** - Schema, migrations, maintenance
- **[Architecture Overview](./overall-architecture.md)** - System design
- **[Troubleshooting Guide](./on-premise-database-setup.md#troubleshooting)** - Common issues

---

## Support

If you need help:

1. ✅ Check [Troubleshooting section](./on-premise-database-setup.md#troubleshooting)
2. ✅ Review logs: `pm2 logs converge-backend`
3. ✅ Check database: `psql -h localhost -U converge_user -d converge_db`
4. ✅ Consult complete documentation above

---

## System Requirements Recap

**Minimum Server Specs:**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB
- OS: Ubuntu 20.04+ / CentOS 8+ / macOS

**Required Ports:**
- 5432 (PostgreSQL)
- 3000 (Backend API)

**Required Software:**
- PostgreSQL 16.8+
- Node.js 20+
- npm/yarn

---

**🎉 That's it! Your backend should now be running and connected to your frontend.**

For detailed troubleshooting, maintenance, and advanced topics, refer to the [complete on-premise setup guide](./on-premise-database-setup.md).

---

**Document Maintained By:** DevOps Team  
**Last Updated:** April 13, 2026

