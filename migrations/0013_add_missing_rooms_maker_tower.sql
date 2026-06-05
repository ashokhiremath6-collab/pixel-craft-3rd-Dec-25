-- 0013_add_missing_rooms_maker_tower.sql
-- Adds 5 rooms omitted from 0012: Dining, External Lobby, Staff Room,
-- Staff Bathroom, Walk-in Closet.
-- Also corrects Music Room room_type 'other' → 'study' (spec requires type=study).
-- Guard: only runs if Hiremath Interiors org exists.
-- Idempotent: ON CONFLICT DO NOTHING for INSERTs; UPDATE is a no-op if already 'study'.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organisations WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
  ) THEN RETURN; END IF;

  -- ── ADD 5 MISSING ROOMS ────────────────────────────────────────────────────
  INSERT INTO rooms (id, org_id, project_id, name, room_type, display_order, created_at, updated_at)
  VALUES
    ('7ab6a69b-f773-4ef8-91fa-f437873cebe8','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Dining','other',13,NOW(),NOW()),
    ('705ec25c-f824-455c-94e7-1dfce9a3c0d9','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','External Lobby','other',14,NOW(),NOW()),
    ('1e22c5e5-5d0c-406f-ba82-9a3b453810fb','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Staff Room','other',15,NOW(),NOW()),
    ('f9a426ff-e5db-4b3b-b8c4-60b3f2b46020','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Staff Bathroom','bathroom',16,NOW(),NOW()),
    ('047afbf7-8727-4095-8c3c-05f4fef5c906','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Walk-in Closet','other',17,NOW(),NOW())
  ON CONFLICT DO NOTHING;

  -- ── FIX MUSIC ROOM TYPE ────────────────────────────────────────────────────
  -- UUID 6cf86e94 = Music Room, seeded in 0012 with room_type='other'
  UPDATE rooms
  SET room_type = 'study', updated_at = NOW()
  WHERE id = '6cf86e94-73db-4707-bc3e-1a3cbf6fe342'
    AND org_id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
    AND room_type <> 'study';

END $$;
