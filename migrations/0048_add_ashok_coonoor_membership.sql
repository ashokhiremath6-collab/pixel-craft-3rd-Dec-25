-- Link Ashok (ashokhiremath6@gmail.com, user_id 46833846) to the Coonoor Projects org
-- so the org switcher appears for him. Safe to run multiple times and in any environment.
-- Guards prevent FK violations if the user or org doesn't exist in a given database.
INSERT INTO user_roles (id, user_id, role, org_id, is_active, assigned_by, created_at)
SELECT
  gen_random_uuid(),
  '46833846',
  'admin',
  '76fe8e5d-a3f2-4832-b75d-db876476e72f',
  true,
  '46833846',
  NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE id = '46833846')
  AND EXISTS (SELECT 1 FROM organisations WHERE id = '76fe8e5d-a3f2-4832-b75d-db876476e72f')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = '46833846'
      AND org_id  = '76fe8e5d-a3f2-4832-b75d-db876476e72f'
  );
