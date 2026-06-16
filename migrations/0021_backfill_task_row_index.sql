-- Backfill row_index for imported tasks that were created before explicit
-- row indexing was added to the import code. Tasks that belong to a schedule
-- (schedule_id IS NOT NULL) but have no row_index get a stable 0-based index
-- derived from their insertion order (created_at ASC, id ASC) within each
-- schedule. This prevents random UUID ordering from breaking the Gantt display.

UPDATE tasks t
SET row_index = sub.rn - 1
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY schedule_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM tasks
  WHERE schedule_id IS NOT NULL
    AND row_index IS NULL
) sub
WHERE t.id = sub.id;
