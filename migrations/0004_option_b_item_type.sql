-- Option B Migration: solution->bundle; category->product; enforce check constraint
-- Safe to run multiple times (idempotent best-effort)

BEGIN;

-- Backup table (one-time best-effort)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'item_backup_optb'
  ) THEN
    EXECUTE 'CREATE TABLE item_backup_optb AS SELECT * FROM item';
  END IF;
END $$;

-- Migrate item_type values per Option B
UPDATE item SET item_type = 'bundle' WHERE item_type = 'solution';
UPDATE item SET item_type = 'product' WHERE item_type = 'category';
-- 'product' remains 'product'

-- Enforce valid values
ALTER TABLE item DROP CONSTRAINT IF EXISTS check_item_type_values;
ALTER TABLE item ADD CONSTRAINT check_item_type_values
  CHECK (item_type IN ('bundle','product'));

COMMIT;


