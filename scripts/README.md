# Scripts Directory

Essential scripts for database management, deployment, and maintenance.

## 📁 Available Scripts

### Database Management

#### `db-manager.sh`

**Purpose**: Comprehensive database management interface  
**Usage**:

```bash
./scripts/db-manager.sh
```

**Features**:

- Interactive menu for database operations
- Seeding (local and AWS)
- Schema management
- Backup and restore
- Connection testing

**When to use**: Primary tool for all database operations

---

#### `seed-items.ts`

**Purpose**: TypeScript seeding script for items, target audiences, and features  
**Usage**:

```bash
npx tsx scripts/seed-items.ts
```

**What it seeds**:

- 7 Solutions
- 25 Categories
- 42 Products (including 7 Managed Surveillance products)
- 10 Target Audiences
- All item relationships

**When to use**: When you need to seed or reseed the database programmatically

---

#### `seed-aws-db.sh`

**Purpose**: Automated AWS RDS database seeding  
**Usage**:

```bash
./scripts/seed-aws-db.sh
```

**Features**:

- Connects to AWS RDS automatically
- Runs seed-items.ts
- Verifies seeding success
- Shows summary of seeded data

**When to use**: When deploying to AWS or reseeding AWS staging database

---

#### `setup-aws-db.sh`

**Purpose**: Initial AWS RDS database setup  
**Usage**:

```bash
./scripts/setup-aws-db.sh
```

**Features**:

- Creates database schema
- Sets up tables and relationships
- Applies initial migrations
- Configures indexes

**When to use**: First-time AWS RDS setup or complete database rebuild

---

### Deployment

#### `deploy-aws.sh`

**Purpose**: Deploy application to AWS ECS/Fargate  
**Usage**:

```bash
./scripts/deploy-aws.sh
```

**Features**:

- Builds Docker image
- Pushes to AWS ECR
- Updates ECS service
- Handles Terraform state

**When to use**: Deploying new versions to AWS staging/production

---

### Utilities

#### `kill-port.sh`

**Purpose**: Kill processes running on a specific port  
**Usage**:

```bash
./scripts/kill-port.sh 3000
```

**Features**:

- Finds processes using specified port
- Kills the process
- Confirms port is free

**When to use**: When you get "port already in use" errors

---

## 📚 Documentation

### `SEEDING_GUIDE.md`

Comprehensive guide for database seeding:

- Local vs AWS seeding
- Manual seeding steps
- Troubleshooting
- Verification methods

---

## 🚀 Quick Start

### First Time Setup

1. **Setup AWS Database**:

   ```bash
   ./scripts/setup-aws-db.sh
   ```

2. **Seed Database**:

   ```bash
   ./scripts/seed-aws-db.sh
   ```

3. **Verify**:
   ```bash
   ./scripts/db-manager.sh
   # Select "Test Connection" then "Count Items"
   ```

### Daily Development

1. **Kill stuck ports**:

   ```bash
   ./scripts/kill-port.sh 3000
   ```

2. **Reseed database**:

   ```bash
   npx tsx scripts/seed-items.ts
   ```

3. **Deploy changes**:
   ```bash
   ./scripts/deploy-aws.sh
   ```

---

## 🗑️ Removed Scripts

The following scripts were removed as they were one-time use or deprecated:

- ~~`add-surveillance-products.*`~~ - Products already added
- ~~`fix-user-selection-schema.sql`~~ - Migration completed
- ~~`migrate-to-items.sql`~~ - Migration completed
- ~~`MIGRATION_GUIDE.md`~~ - Historical documentation
- ~~`seed-items-from-csv.ts`~~ - Deprecated
- ~~`seed-wine-db.sh`~~ - Deprecated
- ~~`db-editor.sh`~~ - Duplicate of db-manager.sh

---

## 📊 Current Database State

**Total Items**: 74 (all active)

- 7 Solutions
- 25 Categories
- 42 Products

**Target Audiences**: 10

- Enterprise, SME, Hospitality, Banking & Financial Services
- Construction & Mining, Government & Retails, Multinational Companies
- Digital Innovators, Small Branches, Residential (coming soon)

**Latest Addition**: 7 Managed Surveillance products (IDs: 68-74)

---

## 🔧 Maintenance

### Updating Seeded Data

To add new products:

1. Edit `scripts/seed-items.ts`
2. Add your new items to the appropriate array
3. Run: `npx tsx scripts/seed-items.ts`
4. Update `postman/SEEDED_ITEMS_REFERENCE.md`
5. Commit changes

### Database Backup

```bash
./scripts/db-manager.sh
# Select "Backup Database"
```

### Database Restore

```bash
./scripts/db-manager.sh
# Select "Restore Database"
```

---

## 🆘 Troubleshooting

### "Permission Denied" Error

```bash
chmod +x scripts/*.sh
```

### "Connection Failed" Error

1. Check your `.env` file has correct AWS credentials
2. Verify AWS security group allows your IP
3. Test connection: `./scripts/db-manager.sh` → "Test Connection"

### "Port Already in Use"

```bash
./scripts/kill-port.sh 3000
```

### Seeding Fails

1. Check database connection
2. Verify schema is up to date: `./scripts/setup-aws-db.sh`
3. Check logs for specific errors
4. Try manual seeding: `./scripts/db-manager.sh` → "Seed Database"

---

## 📞 Support

For issues or questions:

1. Check `SEEDING_GUIDE.md` for detailed documentation
2. Review error logs in console
3. Contact the development team

---

**Last Updated**: October 10, 2025  
**Database Version**: PostgreSQL 16.8  
**Status**: ✅ Production Ready
