# Database Documentation

**Purpose:** Complete database schema, setup, and management documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Setup & Migration](#setup--migration)
4. [Key Tables](#key-tables)
5. [Relationships](#relationships)
6. [Full-Text Search](#full-text-search)
7. [Session Management](#session-management)
8. [Backup & Recovery](#backup--recovery)
9. [Performance Optimization](#performance-optimization)

---

## Overview

The Converge Backend uses **PostgreSQL 16.8** as its primary database. The database is designed for:

- **E-commerce product catalog** (hierarchical structure)
- **Chat sessions and conversations** (AI chatbot)
- **Shopping cart management**
- **User preferences and selections**
- **Sales lead tracking**

**Database Name:** `converge_db` (configurable)  
**Deployment Options:** On-Premise, AWS RDS, or Cloud PostgreSQL  
**Total Tables:** 15

### Deployment Options

1. **On-Premise PostgreSQL** (Recommended for client handover)
   - Self-hosted on your infrastructure
   - Full control over configuration and security
   - **See:** [On-Premise Database Setup Guide](./on-premise-database-setup.md)

2. **AWS RDS** (Managed cloud database)
   - Hosted on AWS (db.t4g.micro for staging)
   - Automated backups and updates
   - **See:** [AWS & Terraform Documentation](./aws-terraform-docs.md)

3. **Other Cloud Providers**
   - Google Cloud SQL, Azure Database for PostgreSQL, etc.
   - Similar setup process to on-premise

---

## Database Schema

### Schema Overview

```
┌─────────────────┐
│     users       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ chat_sessions   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│chat_conversations│
└─────────────────┘

┌─────────────────┐
│ target_audience │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      items      │◄───┐ (hierarchical)
│ (Solutions/     │    │
│  Categories/    │    │
│  Products)      │    │
└─────────────────┘    │
         │              │
         ▼              │
┌─────────────────┐    │
│ product_category│────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    product      │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ product_feature │
│   & feature     │
└─────────────────┘

┌─────────────────┐
│  item_feature   │
│   & feature     │
└─────────────────┘

┌─────────────────┐
│ user_selection  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  sales_lead     │
│  & sales_lead_  │
│  user_selection │
└─────────────────┘

┌─────────────────┐
│session_cleanup_ │
│     logs        │
└─────────────────┘
```

---

## Setup & Migration

### Quick Start: Database Setup Using Export Scripts

The fastest way to set up a fresh database with production-ready data.

#### Prerequisites

1. **PostgreSQL Client Tools** (version 16 recommended)

   ```bash
   # macOS
   brew install postgresql@16

   # Ubuntu
   sudo apt-get install postgresql-16
   ```

2. **Environment Variables** (in `.env` file)
   ```bash
   DB_HOST=your-rds-endpoint.rds.amazonaws.com  # or localhost
   DB_PORT=5432
   DB_NAME=converge_staging_db
   DB_USER=postgres
   DB_PASSWORD=your_secure_password
   ```

#### Step 1: Initialize Database (Schema + Seed Data)

Run the single initialization script that creates all tables and seeds the product catalog:

```bash
# Navigate to project root
cd converge-global-be

# Run the full initialization (schema + seed data)
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  < docs/db-scripts/init-database-20260407.sql
```

**What this creates:**

- ✅ All 15 database tables
- ✅ Foreign key constraints
- ✅ Indexes (including full-text search)
- ✅ Functions (session cleanup)
- ✅ Triggers

**What this seeds:**

- ✅ `feature` - Product features (319 features)
- ✅ `item` - Product catalog (1,044 items)
- ✅ `product` - Products (legacy table)
- ✅ `product_category` - Categories
- ✅ `product_feature` - Feature relationships
- ✅ `target_audience` - Customer segments

**What's NOT seeded (clean start):**

- ❌ `chat_conversations` - Empty (no chat history)
- ❌ `chat_sessions` - Empty (no sessions)
- ❌ `sales_lead` - Empty (no leads)
- ❌ `user_selection` - Empty (no selections)
- ❌ `session_cleanup_logs` - Empty (no logs)

#### Step 2: Verify Setup

```bash
# Connect to database
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME

# Check tables
\dt

# Verify data
SELECT COUNT(*) FROM item;          -- Should show ~1044 items
SELECT COUNT(*) FROM feature;       -- Should show ~319 features
SELECT COUNT(*) FROM target_audience; -- Should show ~10 audiences

# Exit
\q
```

---

### Updating Export Scripts (Export Fresh Data from RDS)

If you need to refresh the schema/seeding files from the current RDS database:

#### Option 1: Export Everything (Recommended)

```bash
# Export both schema and data
./scripts/export-rds-complete.sh
```

This creates:

- `docs/db-scripts/rds-schema-YYYYMMDD-HHMMSS.sql` (schema)
- `docs/db-scripts/rds-seeding-YYYYMMDD-HHMMSS.sql` (data)

#### Option 2: Export Schema Only

```bash
# Export just the database structure
./scripts/export-rds-schema.sh
```

#### Option 3: Export Data Only

```bash
# Export just the data (INSERT statements)
./scripts/export-rds-data.sh
```

**Note:** All export scripts:

- ✅ Use PostgreSQL 16 tools (matches RDS version)
- ✅ Read credentials from `.env` file
- ✅ Include detailed progress output
- ✅ Save files with timestamps

---

### Initial Setup (Alternative Methods)

#### On-Premise PostgreSQL Setup (Recommended for Client Handover)

For complete step-by-step guide with installation, configuration, and backend setup:

**📖 See:** [On-Premise Database Setup Guide](./on-premise-database-setup.md)

This guide includes:
- PostgreSQL installation (Ubuntu/CentOS/macOS/Docker)
- Database creation and user setup
- Schema initialization and seeding
- Backend configuration
- Testing and verification
- Troubleshooting

#### AWS RDS Setup

The database is created automatically by Terraform. See [aws-terraform-docs.md](./aws-terraform-docs.md) for infrastructure setup.

**Connection Details:**

- **Endpoint**: From `terraform output rds_endpoint`
- **Port**: 5432
- **Database**: `converge_staging_db`
- **Username**: `postgres` (or configured in Terraform)
- **Password**: From AWS Secrets Manager

#### Local Development Setup

**Option 1: Local PostgreSQL**

```bash
# Install PostgreSQL
brew install postgresql@16  # macOS
# or
sudo apt-get install postgresql-16  # Ubuntu

# Create database
createdb converge_staging_db

# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=converge_staging_db
export DB_USER=postgres
export DB_PASSWORD=your_password
```

**Option 2: Docker PostgreSQL**

```bash
docker run --name converge-db \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=converge_staging_db \
  -p 5432:5432 \
  -d postgres:16.8
```

### Database Migrations

#### Migration Files

**Location:** `migrations/`

| File                                    | Purpose                              |
| --------------------------------------- | ------------------------------------ |
| `0001_fix_user_selection_for_items.sql` | Fix user selection foreign keys      |
| `0002_add_full_text_search.sql`         | Add full-text search indexes         |
| `0003_setup_session_cleanup.sql`        | Session cleanup function and trigger |
| `0004_option_b_item_type.sql`           | Item type migration                  |
| `0005_add_item_feature_table.sql`       | Add item_feature junction table      |

#### Running Migrations

**Option 1: Using Drizzle ORM**

```bash
# Push schema changes
npm run db:push

# Generate migrations
npm run db:generate

# Apply migrations
npm run db:migrate
```

**Option 2: Manual SQL Execution**

```bash
# Connect to database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Or via Docker
docker exec -it converge-db psql -U postgres -d converge_staging_db

# Run migration
\i migrations/0001_fix_user_selection_for_items.sql
```

**Option 3: Via Application (ECS)**

```bash
# Execute command in running ECS task
aws ecs execute-command \
  --cluster converge-backend-staging-cluster \
  --task TASK_ARN \
  --container converge-backend-app \
  --command "npm run db:push" \
  --interactive \
  --region ap-southeast-1
```

### Schema Initialization

**Recommended: Use the consolidated initialization script** (see Quick Start section above)

```bash
# Full fresh database setup (schema + seed data in one command)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < docs/db-scripts/init-database-20260407.sql
```

**Legacy files** (kept for reference, use the consolidated script instead):
- `docs/db-scripts/rds-schema-20251107-093236.sql` — schema only
- `docs/db-scripts/rds-seeding-20251107-093236.sql` — seed data only

---

## Key Tables

### Core Tables

#### `users`

Stores user information (anonymous and registered).

| Column       | Type         | Description                 |
| ------------ | ------------ | --------------------------- |
| `id`         | UUID         | Primary key                 |
| `email`      | VARCHAR(255) | Unique email                |
| `name`       | VARCHAR(255) | User's name                 |
| `phone`      | VARCHAR(20)  | Phone number                |
| `user_type`  | VARCHAR(50)  | 'anonymous' or 'registered' |
| `created_at` | TIMESTAMP    | Creation timestamp          |
| `updated_at` | TIMESTAMP    | Last update timestamp       |

**Constraints:**

- Primary Key: `id`
- Unique: `email`

#### `chat_sessions`

Manages chat sessions with user preferences and conversation context.

| Column                 | Type         | Description               |
| ---------------------- | ------------ | ------------------------- |
| `id`                   | SERIAL       | Primary key               |
| `session_id`           | VARCHAR(255) | Unique session identifier |
| `user_id`              | UUID         | Reference to users        |
| `user_preferences`     | JSONB        | Stored user preferences   |
| `conversation_context` | TEXT         | AI conversation context   |
| `last_activity_at`     | TIMESTAMP    | Last activity timestamp   |
| `created_at`           | TIMESTAMP    | Session creation time     |

**Key Features:**

- Automatic `last_activity_at` updates
- Session cleanup via trigger (expires inactive sessions)

#### `chat_conversations`

Stores individual messages in chat sessions.

| Column       | Type         | Description                |
| ------------ | ------------ | -------------------------- |
| `id`         | SERIAL       | Primary key                |
| `session_id` | VARCHAR(255) | Reference to chat_sessions |
| `message`    | TEXT         | Message content            |
| `sender`     | VARCHAR(50)  | 'user' or 'assistant'      |
| `created_at` | TIMESTAMP    | Message timestamp          |

**Indexes:**

- On `session_id` for fast retrieval
- On `created_at` for chronological sorting

### Product Tables

#### `items` (Unified Hierarchy)

Single table for Solutions, Categories, and Products.

| Column        | Type         | Description                          |
| ------------- | ------------ | ------------------------------------ |
| `id`          | SERIAL       | Primary key                          |
| `name`        | VARCHAR(255) | Item name                            |
| `description` | TEXT         | Item description                     |
| `item_type`   | VARCHAR(50)  | 'solution', 'category', or 'product' |
| `parent_id`   | INTEGER      | Reference to parent item             |
| `metadata`    | JSONB        | Additional item data                 |
| `created_at`  | TIMESTAMP    | Creation timestamp                   |
| `updated_at`  | TIMESTAMP    | Last update timestamp                |

**Hierarchy:**

- Solutions: `parent_id` is NULL
- Categories: `parent_id` references Solution
- Products: `parent_id` references Category

**Full-Text Search:**

- GIN index on `name` and `description`
- Searchable via PostgreSQL FTS

**See:** [UNIFIED_ITEM_MODEL.md](../UNIFIED_ITEM_MODEL.md)

#### `target_audience`

Defines target audiences for products.

| Column        | Type         | Description          |
| ------------- | ------------ | -------------------- |
| `id`          | SERIAL       | Primary key          |
| `name`        | VARCHAR(255) | Audience name        |
| `description` | TEXT         | Audience description |

#### `item_feature`

Junction table linking items to features. Used by `GET /api/items/:id` to return features for a given item.

| Column       | Type      | Description               |
| ------------ | --------- | ------------------------- |
| `item_id`    | INTEGER   | Reference to items (PK)   |
| `feature_id` | INTEGER   | Reference to feature (PK) |
| `created_at` | TIMESTAMP | Creation timestamp        |

**Constraints:**

- Composite Primary Key: (`item_id`, `feature_id`)
- Foreign Key: `item_id` → `item.id` (CASCADE)
- Foreign Key: `feature_id` → `feature.id` (CASCADE)

#### `product_category`

Product categories (legacy table, being migrated to `items`).

#### `product` and `product_feature`

Product details and features (legacy tables, being migrated to `items`).

### Shopping & Sales Tables

#### `user_selection`

Tracks user's cart selections.

| Column       | Type         | Description            |
| ------------ | ------------ | ---------------------- |
| `id`         | SERIAL       | Primary key            |
| `session_id` | VARCHAR(255) | Chat session reference |
| `item_id`    | INTEGER      | Reference to items     |
| `quantity`   | INTEGER      | Selected quantity      |
| `created_at` | TIMESTAMP    | Selection timestamp    |

#### `sales_lead`

Sales leads generated from user selections.

| Column       | Type        | Description             |
| ------------ | ----------- | ----------------------- |
| `id`         | SERIAL      | Primary key             |
| `user_id`    | UUID        | Reference to users      |
| `status`     | VARCHAR(50) | Lead status             |
| `created_at` | TIMESTAMP   | Lead creation timestamp |

#### `sales_lead_user_selection`

Junction table linking sales leads to user selections.

### System Tables

#### `session_cleanup_logs`

Logs session cleanup operations.

| Column              | Type      | Description                |
| ------------------- | --------- | -------------------------- |
| `id`                | SERIAL    | Primary key                |
| `sessions_deleted`  | INTEGER   | Number of sessions deleted |
| `cleanup_timestamp` | TIMESTAMP | Cleanup execution time     |

---

## Relationships

### Foreign Key Constraints

1. **chat_sessions.user_id** → `users.id`
2. **chat_conversations.session_id** → `chat_sessions.session_id`
3. **items.parent_id** → `items.id` (self-referential)
4. **item_feature.item_id** → `items.id`
5. **item_feature.feature_id** → `feature.id`
6. **user_selection.session_id** → `chat_sessions.session_id`
7. **user_selection.item_id** → `items.id`
8. **sales_lead.user_id** → `users.id`

### Cascading Rules

- **ON DELETE CASCADE**: When a user is deleted, their sessions are deleted
- **ON DELETE RESTRICT**: Prevents deleting items that have selections

---

## Full-Text Search

### Implementation

PostgreSQL Full-Text Search (FTS) is used for fast product search.

**Migration:** `migrations/0002_add_full_text_search.sql`

### Search Indexes

**GIN Indexes** on `items` table:

- `name` (for product name search)
- `description` (for product description search)
- Combined `tsvector` column for full-text search

### Usage

**Example Query:**

```sql
SELECT id, name, description
FROM items
WHERE to_tsvector('english', name || ' ' || COALESCE(description, ''))
  @@ to_tsquery('english', 'security & solution')
ORDER BY ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')),
         to_tsquery('english', 'security & solution')) DESC;
```

**Performance:**

- 3-5x faster than LIKE queries
- Better relevance ranking
- Supports complex search operators

**See:** [SEARCH_FIX_SUMMARY.md](../SEARCH_FIX_SUMMARY.md)

---

## Session Management

### Automatic Cleanup

**Migration:** `migrations/0003_setup_session_cleanup.sql`

**Function:** `cleanup_expired_sessions()`

- Automatically deletes sessions inactive for 30+ days
- Runs via scheduled trigger
- Logs cleanup operations to `session_cleanup_logs`

### Configuration

**Session Expiration:** 30 days (configurable)

**Cleanup Frequency:** Daily via trigger

**Manual Cleanup:**

```sql
-- Run cleanup manually
SELECT cleanup_expired_sessions();

-- Check cleanup logs
SELECT * FROM session_cleanup_logs ORDER BY cleanup_timestamp DESC LIMIT 10;
```

### Activity Tracking

`last_activity_at` is automatically updated on:

- New chat messages
- User selections
- Session updates

**See:** [MIGRATION_EXECUTION_SUMMARY.md](../MIGRATION_EXECUTION_SUMMARY.md)

---

## Backup & Recovery

### AWS RDS Automated Backups

**Configuration:**

- **Backup Window**: Daily (maintenance window)
- **Retention Period**: 7 days (configurable)
- **Backup Type**: Automated snapshots

**Access Backups:**

```bash
# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier converge-backend-staging-db \
  --region ap-southeast-1

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier new-db-instance \
  --db-snapshot-identifier snapshot-name \
  --region ap-southeast-1
```

### Manual Backups

**pg_dump:**

```bash
# Full database backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > backup_$(date +%Y%m%d).sql.gz
```

**pg_restore:**

```bash
# Restore from backup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_20250101.sql

# Or from compressed
gunzip < backup_20250101.sql.gz | psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

### Point-in-Time Recovery (RDS)

RDS supports point-in-time recovery (if enabled):

- Can restore to any point within backup retention period
- Useful for accidental data loss

---

## Performance Optimization

### Indexes

**Existing Indexes:**

- Primary keys (automatic)
- Foreign keys (automatic)
- Full-text search indexes (GIN)
- `session_id` on `chat_conversations`
- `last_activity_at` on `chat_sessions` (for cleanup)

**Recommended Indexes:**

```sql
-- Add index for common queries
CREATE INDEX idx_items_item_type ON items(item_type);
CREATE INDEX idx_items_parent_id ON items(parent_id);
CREATE INDEX idx_user_selection_session_id ON user_selection(session_id);
CREATE INDEX idx_chat_conversations_created_at ON chat_conversations(created_at);
```

### Query Optimization

1. **Use EXPLAIN ANALYZE** to identify slow queries
2. **Add indexes** for frequently queried columns
3. **Use LIMIT** to restrict result sets
4. **Avoid SELECT \*** - select only needed columns
5. **Use prepared statements** to reduce parsing overhead

### Connection Pooling

**Drizzle ORM** handles connection pooling automatically.

**Configuration:**

- Default pool size: 10 connections
- Adjustable in database configuration

### Monitoring

**CloudWatch Metrics (RDS):**

- CPU utilization
- Memory usage
- Database connections
- Read/write IOPS
- Storage space

**Query Performance:**

- Enable `pg_stat_statements` extension
- Monitor slow query log
- Use AWS Performance Insights (production)

---

## Database Seeding

### Recommended: Use RDS Export Files

The easiest and most reliable way to seed your database:

```bash
# Fresh database with production data (single command)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < docs/db-scripts/init-database-20260407.sql
```

**Benefits:**

- ✅ Exact copy of production data structure
- ✅ Tested and working product catalog
- ✅ No user/session data (clean start)
- ✅ Includes all indexes and constraints
- ✅ Fast and reliable

### Refreshing Export Files

To get the latest data from RDS:

```bash
# Export fresh schema and data from current RDS
./scripts/export-rds-complete.sh

# Use the newly created timestamped files
```

### Alternative: AWS Database Seeding

**Guide:** [AWS_DATABASE_SEEDING.md](../AWS_DATABASE_SEEDING.md)

**Scripts:** `scripts/seed-aws-db.sh`

**Process:**

1. Connect to RDS instance
2. Run seed SQL scripts
3. Insert initial product data
4. Verify seeded data

### Alternative: Local Seeding (TypeScript)

**Script:** `scripts/seed-items.ts`

```bash
# Run seed script
npm run seed

# Or directly
ts-node scripts/seed-items.ts
```

**Note:** The TypeScript seeding script may be less up-to-date than the RDS export files.

---

## Reference Documents

### Database Schema & Setup

- **[init-database-20260407.sql](../db-scripts/init-database-20260407.sql)** - Full initialization script (schema + seed data) ⭐
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Complete schema documentation
- [database-schema.sql](../database-schema.sql) - Legacy SQL schema definition
- `rds-schema-20251107-093236.sql` - Legacy schema export (use init script instead)
- `rds-seeding-20251107-093236.sql` - Legacy seed export (use init script instead)

### Export Scripts

- `scripts/export-rds-complete.sh` - Export both schema and data
- `scripts/export-rds-schema.sh` - Export schema only
- `scripts/export-rds-data.sh` - Export data only

### Migration & Seeding

- [UNIFIED_ITEM_MODEL.md](../UNIFIED_ITEM_MODEL.md) - Item model documentation
- [MIGRATION_EXECUTION_SUMMARY.md](../MIGRATION_EXECUTION_SUMMARY.md) - Migration history
- [AWS_DATABASE_SEEDING.md](../AWS_DATABASE_SEEDING.md) - AWS seeding guide

---

**Document Maintained By:** Database Team  
**Last Updated:** April 7, 2026
