-- migrations/0002_add_full_text_search.sql

-- Add search_vector column
ALTER TABLE item ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS item_search_vector_idx ON item USING gin(search_vector);

-- Create trigger function to auto-update search_vector
CREATE OR REPLACE FUNCTION item_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update on INSERT/UPDATE
DROP TRIGGER IF EXISTS item_search_vector_update_trigger ON item;
CREATE TRIGGER item_search_vector_update_trigger
  BEFORE INSERT OR UPDATE ON item
  FOR EACH ROW
  EXECUTE FUNCTION item_search_vector_update();

-- Populate search_vector for existing rows
UPDATE item SET search_vector = 
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B')
WHERE search_vector IS NULL;

-- Verify
-- SELECT COUNT(*) as total_items, COUNT(search_vector) as items_with_vector FROM item;

