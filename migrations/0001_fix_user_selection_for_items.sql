-- Migration: Fix user_selection table to support unified item model
-- Date: 2025-10-08
-- Purpose: Make product_id nullable and remove FK constraint to allow itemId-only cart additions

BEGIN;

-- Step 1: Make product_id nullable (was NOT NULL before)
ALTER TABLE user_selection 
ALTER COLUMN product_id DROP NOT NULL;

-- Step 2: Remove foreign key constraint on product_id (it referenced product table)
ALTER TABLE user_selection 
DROP CONSTRAINT IF EXISTS fk_user_selection_product;

-- Step 3: Add foreign key constraint on item_id (references new unified item table)
ALTER TABLE user_selection 
ADD CONSTRAINT fk_user_selection_item 
FOREIGN KEY (item_id) REFERENCES item(id) ON DELETE CASCADE;

-- Step 4: Add check constraint to ensure at least one ID is provided
ALTER TABLE user_selection
DROP CONSTRAINT IF EXISTS user_selection_has_id_check;

ALTER TABLE user_selection
ADD CONSTRAINT user_selection_has_id_check 
CHECK (product_id IS NOT NULL OR item_id IS NOT NULL);

-- Step 3: Add helpful comments
COMMENT ON TABLE user_selection IS 'User product/item selections for cart and lead generation. Supports both legacy productId and new itemId.';
COMMENT ON COLUMN user_selection.product_id IS 'Legacy product ID (optional). Use for backward compatibility or populate with itemId value.';
COMMENT ON COLUMN user_selection.item_id IS 'Unified item model ID (optional). Preferred for new implementations. References item(id).';
COMMENT ON CONSTRAINT user_selection_has_id_check ON user_selection IS 'Ensures at least one of product_id or item_id is provided';

COMMIT;

-- Verify the changes
\echo 'Migration completed. Verifying schema...'

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_selection'
ORDER BY ordinal_position;

\echo 'Checking constraints...'

SELECT
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'user_selection';

