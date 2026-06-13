-- Add drawing_type column to drawings table
-- 'working' = final architect drawings, 'concept' = designer concept/sketch drawings
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS drawing_type text NOT NULL DEFAULT 'working';

-- Index for efficient filtering by type
CREATE INDEX IF NOT EXISTS drawings_drawing_type_idx ON drawings (drawing_type);
