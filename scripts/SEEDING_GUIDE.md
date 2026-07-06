# Database Seeding Guide

## Overview

This guide explains how to seed the Converge staging database with items from the CSV file, including proper target audience associations.

## Prerequisites

1. **Environment Setup**: Ensure your `.env` file has the correct staging database credentials:

```bash
DB_HOST=your-staging-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=converge_staging_db
DB_USER=postgres
DB_PASSWORD=your-password
```

2. **Files Required**:
   - `Products - item.csv` (in project root)
   - `Products - target_audience.csv` (in project root)

## Seeding Process

### Step 1: Run the Seed Script

The seed script will:

1. **Drop** existing `item` and `item_feature` tables
2. **Recreate** the `item` table with proper schema
3. **Seed** target_audience table with all 10 audience types
4. **Import** all 67 items from CSV with target_audience_id mappings
5. **Display** hierarchy and statistics

Run the command:

```bash
npm run seed:items
```

### Step 2: Verify the Seeding

The script will output:

- ✅ Connection status
- 📊 Item counts (solutions, categories, products)
- 🌳 Item hierarchy with parent-child relationships
- 👥 Target audience distribution

Expected output example:

```
📊 Seeding Summary:
   Solutions:  7
   Categories: 25
   Products:   35
   Total:      67
   Target Audiences: 10
```

## Target Audiences

The following target audiences are seeded:

| ID  | Name                         | Description                      |
| --- | ---------------------------- | -------------------------------- |
| 1   | Residential                  |                                  |
| 2   | SME                          |                                  |
| 101 | Hospitality                  | Hotels, resorts                  |
| 102 | Government & Retails         | Public sector, retail businesses |
| 103 | Banking & Financial Services | Financial institutions, banks    |
| 104 | Construction & Mining        | Mining, construction companies   |
| 105 | Enterprise                   | Large-scale business operations  |
| 106 | Small Branches               | Branch offices                   |
| 107 | Multinational Companies      | Global corporations              |
| 108 | Digital Innovators           | Hyperscalers, digital innovators |

## Item Structure

### Solutions (Top Level)

- Internet
- Transport
- Satellite
- Content
- Security Anti-DDos
- Managed Services
- Colocation Data Centers

### Categories (Mid Level)

Each solution contains multiple categories (e.g., Fiber Broadband, Metro Ethernet, etc.)

### Products (Leaf Level)

Specific offerings under each category (e.g., Fiber Broadband PEAK 50-100 mbps)

## Chatbot Integration

The chatbot now uses target_audience to:

1. **Extract** industry/business type from customer queries
2. **Filter** recommendations by matching target audience
3. **Highlight** industry-specific solutions in responses

### Example Queries:

- "I'm looking for internet for my hotel" → Filters to Hospitality items
- "We need security for our bank" → Filters to Banking & Financial Services items
- "Mining site connectivity" → Filters to Construction & Mining items

## Troubleshooting

### Connection Issues

```bash
# Test database connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

### Script Errors

- Ensure CSV files are in the project root
- Check that DB credentials are correct
- Verify network access to RDS endpoint

### Verify Seeding

```sql
-- Check item counts
SELECT item_type, COUNT(*) FROM item GROUP BY item_type;

-- Check target audience distribution
SELECT ta.name, COUNT(i.id)
FROM item i
LEFT JOIN target_audience ta ON i.target_audience_id = ta.id
WHERE i.target_audience_id IS NOT NULL
GROUP BY ta.name;
```

## Rollback

If you need to rollback, simply re-run the seed script. It will:

1. Drop existing tables
2. Recreate fresh schema
3. Re-import all data

No manual cleanup is needed.

## Next Steps

After successful seeding:

1. Test the chatbot with industry-specific queries
2. Verify target audience filtering works correctly
3. Check that recommendations match expected industries
4. Review conversation logs for entity extraction accuracy
