-- Migration: 0005_add_item_feature_table
-- Description: Creates the item_feature junction table linking items to features.
--              The application's Drizzle schema (schema.model.ts) references this table
--              for the GET /api/items/:id endpoint to return features per item.
--              Previously only product_feature existed (legacy product table), causing
--              a 500 error on item lookups.
-- Date: 2026-04-07

-- Create item_feature table
CREATE TABLE IF NOT EXISTS item_feature (
  item_id    INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
  feature_id INTEGER NOT NULL REFERENCES feature(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (item_id, feature_id)
);

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Migration 0005: item_feature table created successfully';
END $$;
