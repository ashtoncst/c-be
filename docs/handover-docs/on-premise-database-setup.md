# On-Premise Database Setup Guide

**Purpose:** Complete guide for setting up PostgreSQL database on-premise for Converge Global Backend

**Target Audience:** Clients with frontend already deployed who need to set up the backend database

**Last Updated:** November 20, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation Options](#installation-options)
4. [Database Setup](#database-setup)
5. [Backend Configuration](#backend-configuration)
6. [Testing & Verification](#testing--verification)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide walks you through setting up a PostgreSQL database on your own infrastructure (on-premise) for the Converge Global Backend application. The frontend is already deployed and will connect to this backend once the database is configured.

### What You'll Set Up

- **PostgreSQL 16.8+** database server
- **Database schema** with all required tables
- **Initial data** (product catalog, features, target audiences)
- **Backend application** connected to your database

### Architecture

```
┌─────────────────────────────────┐
│   Frontend (Already Deployed)   │
│          Next.js App            │
└───────────────┬─────────────────┘
                │ HTTP/REST
                │ WebSocket
                ▼
┌─────────────────────────────────┐
│    Backend (Express.js)         │
│    - REST API                   │
│    - Socket.IO WebSocket        │
│    - AI Chatbot Service         │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  PostgreSQL Database            │
│  (On-Premise Setup)             │
│  - Product catalog              │
│  - Chat sessions                │
│  - User data                    │
└─────────────────────────────────┘
```

**Estimated Setup Time:** 30-45 minutes

---

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB available
- OS: Linux (Ubuntu 20.04+, CentOS 8+), macOS, or Windows Server

**Recommended:**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD
- OS: Ubuntu 22.04 LTS or later

### Required Software

- [ ] **PostgreSQL 16.8+** (we'll install this)
- [ ] **Node.js 20+** (for running the backend)
- [ ] **npm or yarn** (package manager)
- [ ] **Git** (for cloning the repository)

### Required Credentials

- [ ] **Google Gemini API Key** - Get from [Google AI Studio](https://ai.google.dev/)
- [ ] **Database Password** - Choose a secure password for PostgreSQL
- [ ] **Frontend URL** - URL where your frontend is hosted

### Network Requirements

- [ ] Port **5432** available for PostgreSQL
- [ ] Port **3000** available for Backend API
- [ ] Backend server accessible from frontend server
- [ ] Internet access for downloading packages and AI API calls

---

## Installation Options

Choose the installation method that best fits your infrastructure.

### Option A: Ubuntu/Debian Linux (Recommended)

**Best for:** Production on-premise servers

```bash
# Update package list
sudo apt update

# Install PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
# Expected output: psql (PostgreSQL) 16.x
```

### Option B: CentOS/RHEL Linux

**Best for:** Enterprise RHEL environments

```bash
# Install PostgreSQL repository
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Disable built-in PostgreSQL module
sudo dnf -qy module disable postgresql

# Install PostgreSQL 16
sudo dnf install -y postgresql16-server postgresql16-contrib

# Initialize database
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb

# Start and enable
sudo systemctl start postgresql-16
sudo systemctl enable postgresql-16

# Verify installation
/usr/pgsql-16/bin/psql --version
```

### Option C: macOS (Development/Testing)

**Best for:** Local development and testing

```bash
# Install via Homebrew
brew install postgresql@16

# Start PostgreSQL
brew services start postgresql@16

# Verify installation
psql --version
```

### Option D: Docker Container

**Best for:** Containerized deployments or quick setup

```bash
# Pull PostgreSQL 16 image
docker pull postgres:16

# Run PostgreSQL container
docker run --name converge-postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=converge_db \
  -p 5432:5432 \
  -v /path/to/data:/var/lib/postgresql/data \
  -d postgres:16

# Verify container is running
docker ps | grep converge-postgres
```

**✅ PostgreSQL installed!**

---

## Database Setup

### Step 1: Configure PostgreSQL Authentication

PostgreSQL needs to allow connections from the backend application.

#### For Linux (Ubuntu/Debian/CentOS)

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Add this line (replace with your backend server IP if remote)
# For local access:
host    all             all             127.0.0.1/32            md5

# For remote access (replace X.X.X.X with backend server IP):
host    all             all             X.X.X.X/32              md5

# Or for same network access:
host    all             all             192.168.1.0/24          md5

# Save and exit (Ctrl+X, then Y, then Enter)

# Edit PostgreSQL server configuration for remote connections
sudo nano /etc/postgresql/16/main/postgresql.conf

# Find and modify:
listen_addresses = '*'  # Listen on all interfaces

# Save and exit

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### For macOS

```bash
# Edit pg_hba.conf
nano /opt/homebrew/var/postgresql@16/pg_hba.conf

# Add authentication rules (same as Linux above)

# Edit postgresql.conf
nano /opt/homebrew/var/postgresql@16/postgresql.conf

# Modify listen_addresses
listen_addresses = 'localhost'  # Or '*' for all interfaces

# Restart
brew services restart postgresql@16
```

#### For Docker

Docker container is already configured to accept connections. Skip to Step 2.

### Step 2: Create Database User and Database

```bash
# Switch to postgres user (Linux)
sudo -u postgres psql

# Or connect directly (macOS/Docker)
psql -U postgres

# Inside PostgreSQL prompt, run:
```

```sql
-- Create database user with password
CREATE USER converge_user WITH PASSWORD 'your_secure_password_here';

-- Create database
CREATE DATABASE converge_db OWNER converge_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE converge_db TO converge_user;

-- Connect to the new database
\c converge_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO converge_user;

-- Exit
\q
```

**Security Note:** Replace `your_secure_password_here` with a strong password. Store it securely!

### Step 3: Download Database Schema and Seed Files

```bash
# Clone the repository (if not already done)
git clone https://github.com/your-org/converge-global-be.git
cd converge-global-be

# Navigate to project root
cd converge-global-be
```

### Step 4: Initialize Database (Schema + Seed Data)

This creates all tables, indexes, functions, constraints, and seeds the product catalog — all in one command.

```bash
# Initialize database (schema + seed data)
psql -h localhost -p 5432 -U converge_user -d converge_db \
  -f docs/db-scripts/init-database-20260407.sql

# You'll be prompted for the password you set earlier
# Password: your_secure_password_here
```

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
INSERT 0 319  (features)
INSERT 0 1044 (items/products)
...
(Multiple statements executed successfully)
```

### Step 6: Verify Database Setup

```bash
# Connect to database
psql -h localhost -p 5432 -U converge_user -d converge_db

# Check tables exist
\dt

# Expected output: List of 13 tables
# - chat_conversations
# - chat_sessions
# - feature
# - item
# - product
# - product_category
# - product_feature
# - sales_lead
# - sales_lead_user_selection
# - session_cleanup_logs
# - target_audience
# - user_selection
# - users

# Verify data
SELECT COUNT(*) FROM item;
-- Expected: ~1044 items

SELECT COUNT(*) FROM feature;
-- Expected: ~319 features

SELECT COUNT(*) FROM target_audience;
-- Expected: ~10 audiences

# Check database size
SELECT pg_size_pretty(pg_database_size('converge_db'));
-- Expected: ~5-10 MB

# Exit
\q
```

**✅ Database ready!**

---

## Backend Configuration

### Step 1: Install Backend Dependencies

```bash
# Navigate to backend directory
cd /path/to/converge-global-be

# Install Node.js dependencies
npm install

# This will install:
# - Express.js
# - Socket.IO
# - Drizzle ORM
# - PostgreSQL driver
# - Google Gemini SDK
# - And all other dependencies
```

### Step 2: Create Environment Configuration

Create a `.env` file in the backend root directory:

```bash
# Create .env file
nano .env
```

Add the following configuration:

```bash
# Application Environment
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=converge_db
DB_USER=converge_user
DB_PASSWORD=your_secure_password_here

# Google Gemini AI
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here

# Optional: GCP Configuration (if using Vertex AI instead of Gemini API)
# GCP_PROJECT_ID=your-gcp-project-id
# VERTEX_AI_LOCATION=us-central1

# CORS Configuration (your frontend URL)
CORS_ORIGIN=https://your-frontend-domain.com

# Session Configuration
SESSION_SECRET=generate_random_string_here
SESSION_TIMEOUT_DAYS=30

# Logging
LOG_LEVEL=info
```

**Configuration Notes:**

1. **DB_HOST**:
   - Use `localhost` if backend runs on same server as database
   - Use database server IP/hostname if remote (e.g., `192.168.1.100`)

2. **DB_PASSWORD**: Use the password you set in Step 2

3. **GOOGLE_GEMINI_API_KEY**: Get from [Google AI Studio](https://ai.google.dev/)
   - Sign in with Google account
   - Go to "Get API key"
   - Create new API key or use existing

4. **CORS_ORIGIN**: Your frontend URL (e.g., `https://app.yourcompany.com`)

5. **SESSION_SECRET**: Generate random string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### Step 3: Build the Backend

```bash
# Compile TypeScript to JavaScript
npm run build

# This creates the dist/ directory with compiled code
```

### Step 4: Run Database Migrations (Optional)

If you want to apply any pending migrations:

```bash
# Apply schema changes
npm run db:push

# Or run migrations manually
npm run db:migrate
```

### Step 5: Start the Backend

#### Development Mode (with hot reload)

```bash
npm run dev
```

#### Production Mode

```bash
# Start the server
npm start

# Or using PM2 for process management (recommended)
npm install -g pm2
pm2 start dist/index.js --name converge-backend
pm2 save
pm2 startup  # Follow instructions to start on boot
```

**Expected Output:**

```
Server is running on http://localhost:3000
Connected to database successfully
WebSocket server is ready
```

**✅ Backend running!**

---

## Testing & Verification

### 1. Health Check Endpoint

```bash
# Test backend is responding
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-20T..."}
```

### 2. Database Connection Test

```bash
# Check database connectivity
curl http://localhost:3000/api/items?limit=5

# Expected: JSON array with 5 items
```

### 3. API Documentation

Open your browser and navigate to:
```
http://your-server-ip:3000/api/docs
```

You should see the Swagger API documentation.

### 4. WebSocket Connection Test

Create a simple test file `test-websocket.js`:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected!');
  
  // Test chat message
  socket.emit('chat:message', {
    sessionId: 'test-session',
    message: 'Hello, test message'
  });
});

socket.on('chat:message', (data) => {
  console.log('📨 Received:', data);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});
```

Run the test:
```bash
node test-websocket.js
```

### 5. Frontend Integration Test

Update your frontend configuration to point to the backend:

**Frontend `.env` or config:**
```bash
NEXT_PUBLIC_API_URL=http://your-backend-server-ip:3000
NEXT_PUBLIC_SOCKET_URL=ws://your-backend-server-ip:3000
```

**For production (with HTTPS):**
```bash
NEXT_PUBLIC_API_URL=https://api.yourcompany.com
NEXT_PUBLIC_SOCKET_URL=wss://api.yourcompany.com
```

Open your frontend and:
1. Navigate to AI Assistant / Chat
2. Send a test message
3. Verify you receive an AI-generated response
4. Check product search functionality

**✅ Full integration working!**

---

## Maintenance

### Daily Tasks

#### Monitor Backend Logs

```bash
# If using PM2
pm2 logs converge-backend

# If running directly
tail -f /path/to/logs/backend.log
```

#### Check Database Connections

```bash
# Connect to database
psql -h localhost -U converge_user -d converge_db

# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'converge_db';

# Check database size
SELECT pg_size_pretty(pg_database_size('converge_db'));
```

### Weekly Tasks

#### Backup Database

```bash
# Create backup directory
mkdir -p /backups/postgres

# Full database backup
pg_dump -h localhost -U converge_user -d converge_db \
  -F c -b -v -f /backups/postgres/converge_db_$(date +%Y%m%d).backup

# Or SQL format
pg_dump -h localhost -U converge_user -d converge_db \
  > /backups/postgres/converge_db_$(date +%Y%m%d).sql

# Compress backup
gzip /backups/postgres/converge_db_$(date +%Y%m%d).sql
```

#### Clean Old Sessions

The database has automatic session cleanup, but you can verify:

```bash
psql -h localhost -U converge_user -d converge_db

# Check cleanup logs
SELECT * FROM session_cleanup_logs 
ORDER BY cleanup_timestamp DESC 
LIMIT 10;

# Manually trigger cleanup if needed
SELECT cleanup_expired_sessions();
```

### Monthly Tasks

#### Database Maintenance

```bash
psql -h localhost -U converge_user -d converge_db

# Analyze tables for query optimization
ANALYZE;

# Vacuum to reclaim space
VACUUM;

# Full vacuum (requires exclusive lock, do during maintenance window)
VACUUM FULL;

# Reindex if needed
REINDEX DATABASE converge_db;
```

#### Update Application

```bash
# Pull latest code
cd /path/to/converge-global-be
git pull origin main

# Install new dependencies
npm install

# Build
npm run build

# Restart backend
pm2 restart converge-backend

# Or if not using PM2
# Stop the current process and restart
```

### Backup Strategy

**Recommended Setup:**

1. **Daily Automated Backups**
   ```bash
   # Add to crontab
   crontab -e
   
   # Add this line (runs daily at 2 AM)
   0 2 * * * /path/to/backup-script.sh
   ```

2. **Backup Retention**
   - Keep daily backups for 7 days
   - Keep weekly backups for 4 weeks
   - Keep monthly backups for 12 months

3. **Test Restore Quarterly**
   ```bash
   # Test restoring to a different database
   createdb converge_db_test
   pg_restore -h localhost -U converge_user -d converge_db_test \
     /backups/postgres/converge_db_20251120.backup
   ```

---

## Troubleshooting

### Issue: Cannot connect to PostgreSQL

**Symptoms:**
```
ECONNREFUSED
Could not connect to database
```

**Check:**
```bash
# Is PostgreSQL running?
sudo systemctl status postgresql

# Is PostgreSQL listening on correct port?
sudo netstat -plnt | grep 5432

# Can you connect locally?
psql -h localhost -U converge_user -d converge_db
```

**Fix:**
```bash
# Start PostgreSQL if not running
sudo systemctl start postgresql

# Check pg_hba.conf authentication
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Check postgresql.conf listen addresses
sudo nano /etc/postgresql/16/main/postgresql.conf

# Restart after changes
sudo systemctl restart postgresql
```

### Issue: Authentication failed for user

**Symptoms:**
```
password authentication failed for user "converge_user"
```

**Fix:**
```bash
# Reset user password
sudo -u postgres psql

# In psql:
ALTER USER converge_user WITH PASSWORD 'new_secure_password';
\q

# Update .env file with new password
nano .env
# DB_PASSWORD=new_secure_password

# Restart backend
pm2 restart converge-backend
```

### Issue: Database schema not found

**Symptoms:**
```
relation "item" does not exist
table "chat_sessions" does not exist
```

**Fix:**
```bash
# Re-run full initialization (schema + seed data)
cd converge-global-be
psql -h localhost -U converge_user -d converge_db \
  -f docs/db-scripts/init-database-20260407.sql
```

### Issue: No data in database

**Symptoms:**
- Empty product lists
- No items returned from API

**Fix:**
```bash
# Re-run initialization (schema + seed data)
cd converge-global-be
psql -h localhost -U converge_user -d converge_db \
  -f docs/db-scripts/init-database-20260407.sql

# Verify data
psql -h localhost -U converge_user -d converge_db \
  -c "SELECT COUNT(*) FROM item;"
```

### Issue: Backend cannot reach Gemini API

**Symptoms:**
```
Failed to generate AI response
API key not valid
```

**Check:**
```bash
# Test API key
curl "https://generativelanguage.googleapis.com/v1/models?key=YOUR_API_KEY"

# Should return list of models
```

**Fix:**
1. Verify API key is correct in `.env`
2. Check API key is enabled at [Google AI Studio](https://ai.google.dev/)
3. Ensure server has internet access
4. Check firewall rules

### Issue: WebSocket connection failed

**Symptoms:**
- Frontend shows "Connecting..."
- No real-time chat updates

**Check:**
```bash
# Check if backend is listening on correct port
netstat -plnt | grep 3000

# Check firewall allows port 3000
sudo ufw status
```

**Fix:**
```bash
# Open firewall port
sudo ufw allow 3000/tcp

# Verify backend logs
pm2 logs converge-backend

# Check CORS_ORIGIN in .env matches frontend URL
nano .env
```

### Issue: High memory usage

**Symptoms:**
- Server becomes slow
- Out of memory errors

**Check:**
```bash
# Check memory usage
free -h

# Check process memory
ps aux | grep node

# Check database connections
psql -h localhost -U converge_user -d converge_db \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

**Fix:**
```bash
# Limit database connection pool
# Edit .env
DB_POOL_MAX=10

# Restart backend with limited memory
pm2 restart converge-backend --node-args="--max-old-space-size=4096"

# Or optimize PostgreSQL
sudo nano /etc/postgresql/16/main/postgresql.conf
# shared_buffers = 256MB
# effective_cache_size = 1GB

sudo systemctl restart postgresql
```

### Issue: Disk space running out

**Check:**
```bash
# Check disk usage
df -h

# Check database size
psql -h localhost -U converge_user -d converge_db \
  -c "SELECT pg_size_pretty(pg_database_size('converge_db'));"

# Check largest tables
psql -h localhost -U converge_user -d converge_db \
  -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

**Fix:**
```bash
# Clean old logs
sudo journalctl --vacuum-time=7d

# Clean old backups
find /backups/postgres -name "*.backup" -mtime +30 -delete

# Vacuum database
psql -h localhost -U converge_user -d converge_db -c "VACUUM FULL;"

# Clean old sessions (should happen automatically)
psql -h localhost -U converge_user -d converge_db \
  -c "SELECT cleanup_expired_sessions();"
```

---

## Security Best Practices

### Database Security

1. **Use Strong Passwords**
   - Minimum 16 characters
   - Mix of letters, numbers, symbols
   - Change quarterly

2. **Limit Network Access**
   ```bash
   # Only allow specific IPs in pg_hba.conf
   host    converge_db    converge_user    192.168.1.10/32    md5
   ```

3. **Regular Updates**
   ```bash
   # Keep PostgreSQL updated
   sudo apt update
   sudo apt upgrade postgresql-16
   ```

4. **Monitor Access**
   ```bash
   # Check failed login attempts
   sudo grep "authentication failed" /var/log/postgresql/postgresql-16-main.log
   ```

### Backend Security

1. **Use Process Manager**
   - Use PM2 or systemd
   - Auto-restart on failure
   - Log management

2. **Firewall Configuration**
   ```bash
   # Only allow necessary ports
   sudo ufw allow 3000/tcp  # Backend API
   sudo ufw allow 5432/tcp from 192.168.1.0/24  # PostgreSQL from local network
   sudo ufw enable
   ```

3. **Environment Variables**
   - Never commit `.env` to Git
   - Use secure file permissions
   ```bash
   chmod 600 .env
   ```

4. **HTTPS/TLS**
   - Use reverse proxy (Nginx/Apache) with SSL
   - Obtain certificate from Let's Encrypt
   - Redirect HTTP to HTTPS

---

## Next Steps

### Optional Enhancements

1. **Set up Reverse Proxy (Nginx)**
   - SSL/TLS termination
   - Load balancing
   - Better security

2. **Monitoring & Alerting**
   - Prometheus + Grafana for metrics
   - Uptime monitoring
   - Log aggregation

3. **Database Replication**
   - Hot standby for high availability
   - Read replicas for scaling

4. **CI/CD Pipeline**
   - Automated testing
   - Automated deployment
   - Rollback capability

### Support Resources

- **Database Documentation**: [db-docs.md](./db-docs.md)
- **Architecture Overview**: [overall-architecture.md](./overall-architecture.md)
- **LangChain/AI Features**: [langchain-docs.md](./langchain-docs.md)

---

## Quick Reference

### Common Commands

```bash
# Start/Stop PostgreSQL
sudo systemctl start postgresql
sudo systemctl stop postgresql
sudo systemctl restart postgresql

# Connect to database
psql -h localhost -U converge_user -d converge_db

# Backup database
pg_dump -h localhost -U converge_user -d converge_db > backup.sql

# Restore database
psql -h localhost -U converge_user -d converge_db < backup.sql

# Start backend (PM2)
pm2 start dist/index.js --name converge-backend
pm2 restart converge-backend
pm2 stop converge-backend
pm2 logs converge-backend

# Check backend status
pm2 status
pm2 monit

# Update backend
cd /path/to/converge-global-be
git pull
npm install
npm run build
pm2 restart converge-backend
```

### Database Queries

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('converge_db'));

-- Count items
SELECT COUNT(*) FROM item;

-- Check active sessions
SELECT COUNT(*) FROM chat_sessions WHERE last_activity_at > NOW() - INTERVAL '24 hours';

-- View recent conversations
SELECT * FROM chat_conversations ORDER BY created_at DESC LIMIT 10;

-- Clean up old sessions manually
SELECT cleanup_expired_sessions();

-- Check database connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'converge_db';
```

---

## Contact & Support

For technical issues or questions:

1. **Check Troubleshooting section** above
2. **Review logs** for error messages
3. **Consult documentation** in `docs/handover-docs/`
4. **Contact development team** with:
   - Error messages
   - Log files
   - Steps to reproduce
   - System information

---

**Document Maintained By:** DevOps & Backend Team  
**Last Updated:** November 20, 2025  
**Next Review:** February 2026

