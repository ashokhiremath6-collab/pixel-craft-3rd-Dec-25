-- 0010_seed_maker_tower_drawings.sql
-- Drop NOT NULL on org_id across all 6 new drawing tables.
-- Production instance has org_id = NULL throughout (predates multi-tenancy).
-- Data inserts are conditional on the Maker Tower project existing,
-- so this migration is safe to run on dev where the project is absent.

DO $$ BEGIN
  ALTER TABLE "rooms" ALTER COLUMN "org_id" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
-- --> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "drawings" ALTER COLUMN "org_id" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
-- --> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "drawing_revisions" ALTER COLUMN "org_id" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
-- --> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "drawing_approvals" ALTER COLUMN "org_id" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
-- --> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "revision_events" ALTER COLUMN "org_id" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
-- --> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "drawing_comments" ALTER COLUMN "org_id" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
-- --> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = '2de39e0d-ec50-4426-9b9e-69b6868409b0') THEN
    RETURN;
  END IF;

  INSERT INTO rooms (id, org_id, project_id, name, room_type, display_order, created_at, updated_at) VALUES
    ('4d9fce9d-5b28-44d9-a6d0-d5242f2c311a', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Master Bedroom', 'bedroom', 1, now(), now()),
    ('be708bac-b118-445c-9b0f-5c9528dcc1d2', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Master Bathroom', 'bathroom', 2, now(), now()),
    ('e063b910-6b10-4b54-89bc-8f9c8cc9391b', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Music Room', 'bedroom', 3, now(), now()),
    ('4b4457f3-08d5-4892-8de5-e0a7c138950e', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Music Bathroom', 'bathroom', 4, now(), now()),
    ('dad3d570-89ec-4911-a222-71da560495ce', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Chitra''s Room', 'bedroom', 5, now(), now()),
    ('ad9ac576-af0d-42c1-a17b-208a8215e688', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Chitra''s Bathroom', 'bathroom', 6, now(), now()),
    ('6622803f-986a-49c9-923e-6375e38be87a', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Powder Bathroom', 'bathroom', 7, now(), now()),
    ('ddacaf7e-c032-4cbb-9391-ff5542ccb0df', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Sanjiv''s Room', 'bedroom', 8, now(), now()),
    ('452e816d-0882-4304-b1fe-7eb575f160fe', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Living', 'living', 9, now(), now()),
    ('b89790ac-4eae-477f-990c-769ed9b18f38', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Kitchen', 'kitchen', 10, now(), now()),
    ('3ca228e3-ccf5-4fc3-84f3-f919665ef03c', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Study', 'study', 11, now(), now()),
    ('3a956165-5d4d-403c-adc3-c888a065c599', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', 'Foyer', 'foyer', 12, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO drawings (id, org_id, project_id, room_id, title, category, discipline, status, is_template_placeholder, created_at, updated_at) VALUES
    ('ce412f2c-1309-4a49-bdd1-cbf9f4ae9c93', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Sanket for acoustic docment .pdf', 'Specification', 'Interior', 'issued', false, '2025-11-20 05:25:57', '2025-11-20 05:25:57'),
    ('b40e4188-6d7e-4994-9aa8-772c856bcbcf', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Electrical Switch board E-102 Dec 21''2025.pdf', 'Electrical Layout', 'Interior', 'issued', false, '2025-12-22 12:49:32', '2025-12-22 12:49:32'),
    ('e8138b66-2633-4845-abdf-cd299adad3d1', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Electrical Switch board E-101 Dec 21''2025.pdf', 'Electrical Layout', 'Interior', 'issued', false, '2025-12-22 12:50:31', '2025-12-22 12:50:31'),
    ('fff51c16-fa8e-4cd0-868a-0927e00bfaa7', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, '23-12-2025 AUTOMATION LAYOUTS -  BLACK HAWK.pdf', 'Electrical Layout', 'Interior', 'issued', false, '2025-12-23 07:03:24', '2025-12-23 07:03:24'),
    ('6f476de7-553f-4da7-94dd-a2fb4a73b079', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Flooring Layout - 24-12-25.pdf', 'Finishes Schedule', 'Interior', 'issued', false, '2025-12-24 05:23:03', '2025-12-24 05:23:03'),
    ('b11720d2-3f5a-4ad5-8905-8e97723c8e7c', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Maker Makerover Door Dec 08''2025 .pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-03-05 06:51:36', '2026-03-05 06:51:36'),
    ('f3b7c10e-87df-46f4-a506-c3b0c9445ed0', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Kitchen' LIMIT 1), 'Maker Makeover Kitchen Section Feb 17''2026.pdf', 'Elevation', 'Interior', 'issued', false, '2026-03-05 06:53:39', '2026-03-05 06:53:39'),
    ('e1e687d8-255d-448c-bc46-6b1388c073b0', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Window jamb moulding pelmet skirting detail Dec 27''2025.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-03-05 08:02:52', '2026-03-05 08:02:52'),
    ('d642043c-1499-48fd-9edd-d956e95516eb', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Foyer' LIMIT 1), '23-04-2026 - Foyer elevations _ Maker Towers 131 A.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-04-23 07:29:01', '2026-04-23 07:29:01'),
    ('0c9980e8-42c0-453a-b772-33f6f1320dfa', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Music Room' LIMIT 1), 'Music room console internal working drawing.pdf', 'Elevation', 'Interior', 'issued', false, '2026-05-02 13:05:49', '2026-05-02 13:05:49'),
    ('29c2a5ea-7990-4a73-ac5e-ba1bc47f05dc', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Kitchen' LIMIT 1), 'Maker Makeover Kitchen flooring May 06''2026.pdf', 'Finishes Schedule', 'Interior', 'issued', false, '2026-05-06 15:35:21', '2026-05-06 15:35:21'),
    ('fe878f7d-47a6-4a40-9c65-6e76772400e5', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'BATHROOM CABINET & COUNTER REFERENCES  .pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-22 08:48:30', '2026-05-22 08:48:30'),
    ('bef6888a-3202-4537-becc-773b44fe69a4', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Foyer' LIMIT 1), 'Maker MakeOver Main door & foyer panelling May 25''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-25 09:22:19', '2026-05-25 09:22:19'),
    ('b93612e1-196d-4853-94ad-349b54482d6d', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Foyer' LIMIT 1), 'Reflected ceiling layout Foyer May 25''2026.pdf', 'Reflected Ceiling Plan', 'Interior', 'issued', false, '2026-05-25 09:23:08', '2026-05-25 09:23:08'),
    ('94100596-d403-4872-9e0b-40c2dda94fc0', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Chitra''s Room' LIMIT 1), 'Maker MakeOver Chitra''s Room Wardrobe R3 May 24''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 04:49:19', '2026-05-26 04:49:19'),
    ('0ee83598-cf52-49e1-8441-2187d1bd6b5d', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Music Room' LIMIT 1), 'Maker Makeover Music Room wardrobe R3 April 14''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 04:51:36', '2026-05-26 04:51:36'),
    ('b187055b-8a43-470d-90e6-09228cb2617d', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Sanjiv''s Room' LIMIT 1), 'MakersMakeOver Sanjiv''s''s Room Wardrobe R2 April 02''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 04:52:56', '2026-05-26 04:52:56'),
    ('a9616274-24e8-46c7-9927-3983eb2d1d7b', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Master Bedroom' LIMIT 1), 'Maker MakeOver Master Bedroom Wardrobe R3 May24''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 04:55:58', '2026-05-26 04:55:58'),
    ('45c93708-b06d-4eae-9510-508f31452b94', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Electrical switch board R2 March 12''2026.pdf', 'Electrical Layout', 'Interior', 'issued', false, '2026-05-26 05:07:03', '2026-05-26 05:07:03'),
    ('1d6d6fdf-1a15-472a-8bd4-ac2b6cf303a7', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Master Bedroom' LIMIT 1), 'Maker Makeover Cabinetry Master Bedroom TV unit Dec 08''2025.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 05:37:15', '2026-05-26 05:37:15'),
    ('a8a629d5-4f05-47d6-a7d5-7eaffa350082', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Study' LIMIT 1), 'Maker Makeover Study unit May 17''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 06:33:29', '2026-05-26 06:33:29'),
    ('1f36e23d-4e51-4e32-a0d0-2b5ab32a1d85', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Chitra''s Bathroom' LIMIT 1), 'Maker Makeover Chitra''s Bathroom Basin Unit May 22''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 06:35:38', '2026-05-26 06:35:38'),
    ('13cf7df6-a9dc-4696-8846-cf3685f33c46', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Master Bathroom' LIMIT 1), 'Maker Makeover Master Bathroom Basin Unit May 22''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 06:36:16', '2026-05-26 06:36:16'),
    ('4c32923c-ab06-45b9-8536-1b3e77fef841', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Music Bathroom' LIMIT 1), 'Maker Makeover Music Basin Unit ID-109.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 06:37:24', '2026-05-26 06:37:24'),
    ('3db58924-f8ca-41eb-bad5-b13336b18b73', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Powder Bathroom' LIMIT 1), 'Maker Makerover Powder Basin unit  ID-110.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 06:38:26', '2026-05-26 06:38:26'),
    ('97414dae-0dd6-4dcc-9451-fb111b6aaec4', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Living' LIMIT 1), 'Maker Makeover Living Bar Cabinet  R3 May 22''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 07:31:55', '2026-05-26 07:31:55'),
    ('0109bba9-c6c2-471b-99bb-fee07c129808', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Master Bathroom' LIMIT 1), 'Maker Makerover Master Bathroom R-6  FEB 12''2026-ID-101 A  (1).pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 07:41:08', '2026-05-26 07:41:08'),
    ('def1f368-774e-4a4e-9849-bb7727712812', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Powder Bathroom' LIMIT 1), 'Maker Makerover Powder Bathroom R-7  FEB 12''2026 ID-106  (1).pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-26 07:43:39', '2026-05-26 07:43:39'),
    ('ef649cb8-7e56-4fad-9c73-3f443487b61c', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Walling Layout R4 Apr 10''2026.pdf', 'Floor Plan', 'Interior', 'issued', false, '2026-05-26 07:53:02', '2026-05-26 07:53:02'),
    ('50cf2ce0-e963-422e-a90b-d6e2a5b40f98', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Chitra''s Bathroom' LIMIT 1), 'Maker Makerover Chitra''s Bathroom R-6  FEB  14''2026ID-110  (1).pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-27 04:18:11', '2026-05-27 04:18:11'),
    ('0fbfbc52-a855-4f98-9c6a-81139532a718', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Music Bathroom' LIMIT 1), 'Maker Makeover Music Bathroom R6-Feb 14''2026.pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-27 04:58:04', '2026-05-27 04:58:04'),
    ('27a23589-9b7d-4afc-951d-568f31a4ac28', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Kitchen' LIMIT 1), 'BOM_AND_Ms. Supriya Vora_Kitchen & Utility Working Drawings_23rd April 2026 (2).pdf', 'Joinery Detail', 'Interior', 'issued', false, '2026-05-27 10:59:34', '2026-05-27 10:59:34'),
    ('bef0aa17-2b14-4651-85f5-a4d6a06ad7ac', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Original', 'Floor Plan', 'Interior', 'issued', false, '2025-10-01 10:26:10', '2025-10-01 10:26:10'),
    ('6170de00-0b57-4a58-8107-e0394cdc2f43', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'Walling layout', 'Floor Plan', 'Interior', 'issued', false, '2025-10-20 12:08:39', '2025-10-20 12:08:39'),
    ('5d612c0e-44c9-4592-8036-6fb4b9b978f7', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Master Bathroom' LIMIT 1), 'MASTER BATHROOM FLOOR PLAN', 'Floor Plan', 'Interior', 'issued', false, '2025-11-18 07:18:51', '2025-11-18 07:18:51'),
    ('0aaa7fa5-1662-4a3e-9014-dc864dedcf13', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', (SELECT id FROM rooms WHERE project_id='2de39e0d-ec50-4426-9b9e-69b6868409b0' AND name='Music Bathroom' LIMIT 1), 'MUSIC BATHROOM FLOOR PLAN', 'Floor Plan', 'Interior', 'issued', false, '2025-11-18 07:21:35', '2025-11-18 07:21:35'),
    ('acaee2a3-8d7b-418c-9009-bfe17977973a', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'RCP LAYOUT', 'Reflected Ceiling Plan', 'Interior', 'issued', false, '2025-11-20 05:45:01', '2025-11-20 05:45:01'),
    ('19c499a7-39a5-47b3-b86a-e64c0e7ef66d', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'SWITCHBOARD LAYOUT', 'Electrical Layout', 'Interior', 'issued', false, '2025-12-09 17:59:06', '2025-12-09 17:59:06'),
    ('7cec255d-9006-44e6-b359-4cb9b1ae45f5', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'HVAC LAYOUT', 'HVAC Layout', 'Interior', 'issued', false, '2025-12-09 17:59:35', '2025-12-09 17:59:35'),
    ('48f17629-e3d3-4f75-a581-96332ca02fdf', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'FLOORING LAYOUT', 'Finishes Schedule', 'Interior', 'issued', false, '2025-12-09 18:00:09', '2025-12-09 18:00:09'),
    ('b40bb863-0ff9-4c6d-a68f-59d2ebca4312', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'DB WALLING LAYOUT', 'Floor Plan', 'Interior', 'issued', false, '2026-01-27 11:07:54', '2026-01-27 11:07:54'),
    ('1c20ee57-560d-4369-9562-bbdb6efbc20a', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'LIGHTING LAYOUT (Focus Lighting)', 'Electrical Layout', 'Interior', 'issued', false, '2026-01-31 06:49:11', '2026-01-31 06:49:11'),
    ('5c42aa7f-800e-4bba-bb6e-6edb19f74753', NULL, '2de39e0d-ec50-4426-9b9e-69b6868409b0', NULL, 'LIGHTING LAYOUT (Measurement)', 'Electrical Layout', 'Interior', 'issued', false, '2026-03-27 09:16:08', '2026-03-27 09:16:08')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO drawing_revisions (id, org_id, drawing_id, revision_letter, file_path, file_name, file_size, file_mime_type, state, uploaded_by, uploaded_at) VALUES
    ('3eb56ea5-1ed2-413c-9e59-682cf2008191', NULL, 'ce412f2c-1309-4a49-bdd1-cbf9f4ae9c93', 'P1', '/objects/uploads/a4e2be5f-8ea6-43e1-930a-19cfd19851e5', 'Sanket for acoustic docment .pdf', 3575274, 'application/pdf', 'current', NULL, '2025-11-20 05:25:57'),
    ('03b84a7c-51b9-4dea-bd03-3d547889ac3c', NULL, 'b40e4188-6d7e-4994-9aa8-772c856bcbcf', 'P1', '/objects/uploads/4736ab43-9bd4-4ca3-a2a7-f6b93a4d34ef', 'Electrical Switch board E-102 Dec 21''2025.pdf', 603435, 'application/pdf', 'current', NULL, '2025-12-22 12:49:32'),
    ('edb69429-37aa-4c5a-9f00-9afc809d43f6', NULL, 'e8138b66-2633-4845-abdf-cd299adad3d1', 'P1', '/objects/uploads/8e1b3a6e-d17f-4e3f-b225-0e34d2fd22fa', 'Electrical Switch board E-101 Dec 21''2025.pdf', 925665, 'application/pdf', 'current', NULL, '2025-12-22 12:50:31'),
    ('5fa20376-88d0-4bab-8c94-b94f565a0704', NULL, 'fff51c16-fa8e-4cd0-868a-0927e00bfaa7', 'P1', '/objects/uploads/5fb1f9b1-c311-442b-9a34-b166f8fea3e4', '23-12-2025 AUTOMATION LAYOUTS -  BLACK HAWK.pdf', 3133351, 'application/pdf', 'current', NULL, '2025-12-23 07:03:24'),
    ('d7d7ceaa-8f61-4bc4-8f74-bed13cadae0b', NULL, '6f476de7-553f-4da7-94dd-a2fb4a73b079', 'P1', '/objects/uploads/ae6b274f-f76a-406f-b509-7b760faf71e4', 'Flooring Layout - 24-12-25.pdf', 918191, 'application/pdf', 'current', NULL, '2025-12-24 05:23:03'),
    ('f47cf192-616f-40e4-8114-a21048862b56', NULL, 'b11720d2-3f5a-4ad5-8905-8e97723c8e7c', 'P1', '/objects/uploads/4ac23ff3-e837-4f0d-b42a-7b2670ac3684', 'Maker Makerover Door Dec 08''2025 .pdf', 5045455, 'application/pdf', 'current', '48688631', '2026-03-05 06:51:36'),
    ('d5577519-ac98-42b4-8d74-a97c1c913e49', NULL, 'f3b7c10e-87df-46f4-a506-c3b0c9445ed0', 'P1', '/objects/uploads/c8065793-dd83-4fd2-9e2e-3b6a9041975b', 'Maker Makeover Kitchen Section Feb 17''2026.pdf', 1253232, 'application/pdf', 'current', '48688631', '2026-03-05 06:53:39'),
    ('52acfea6-05e7-4c45-ae6c-25f7208d4411', NULL, 'e1e687d8-255d-448c-bc46-6b1388c073b0', 'P1', '/objects/uploads/8a66989d-9d63-449b-b352-6edd9ca75f7f', 'Window jamb moulding pelmet skirting detail Dec 27''2025.pdf', 823662, 'application/pdf', 'current', '48688631', '2026-03-05 08:02:52'),
    ('c9f7e520-cb82-4c86-bd72-2e8d2d92f02d', NULL, 'd642043c-1499-48fd-9edd-d956e95516eb', 'P1', '/objects/uploads/9d08e517-b021-4f5b-8506-333b045198d9', '23-04-2026 - Foyer elevations _ Maker Towers 131 A.pdf', 1028685, 'application/pdf', 'current', '48590680', '2026-04-23 07:29:01'),
    ('5c9094a0-2429-430a-869b-c104e9009230', NULL, '0c9980e8-42c0-453a-b772-33f6f1320dfa', 'P1', '/objects/uploads/cba38214-31d9-4e6f-b29c-87deeb66571f', 'Music room console internal working drawing.pdf', 294460, 'application/pdf', 'current', '48590680', '2026-05-02 13:05:49'),
    ('e8add3a9-08f3-4c60-8fa6-5846d897c7fc', NULL, '29c2a5ea-7990-4a73-ac5e-ba1bc47f05dc', 'P1', '/objects/uploads/e1d3a799-0183-4cce-920e-d5bd50b9573d', 'Maker Makeover Kitchen flooring May 06''2026.pdf', 945794, 'application/pdf', 'current', '48688631', '2026-05-06 15:35:21'),
    ('435d2bcd-a7db-4d63-830d-8a6565687e09', NULL, 'fe878f7d-47a6-4a40-9c65-6e76772400e5', 'P1', '/objects/uploads/cc017707-4734-42e4-b7a0-ae70bb12dbb7', 'BATHROOM CABINET & COUNTER REFERENCES  .pdf', 1834501, 'application/pdf', 'current', '48590680', '2026-05-22 08:48:30'),
    ('aef1f591-56a3-44d6-965a-5508fef4d5bc', NULL, 'bef6888a-3202-4537-becc-773b44fe69a4', 'P1', '/objects/uploads/52bd198d-831d-4750-81a2-afc7096df0eb', 'Maker MakeOver Main door & foyer panelling May 25''2026.pdf', 445328, 'application/pdf', 'superseded', '48688631', '2026-05-25 09:22:19'),
    ('e4ae5aef-fce8-4ec9-b7cb-20a434a4a5e6', NULL, 'b93612e1-196d-4853-94ad-349b54482d6d', 'P1', '/objects/uploads/709ad041-0404-4107-bf17-24db25438939', 'Reflected ceiling layout Foyer May 25''2026.pdf', 722873, 'application/pdf', 'current', '48688631', '2026-05-25 09:23:08'),
    ('5f0a79c2-3b8c-41ee-a9e8-09840332b1aa', NULL, '94100596-d403-4872-9e0b-40c2dda94fc0', 'P1', '/objects/uploads/98687b1f-dc7a-4702-9699-2a685283b3ae', 'Maker MakeOver Chitra''s Room Wardrobe R3 May 24''2026.pdf', 527127, 'application/pdf', 'current', '48688631', '2026-05-26 04:49:19'),
    ('b692fb03-1ccc-4a93-91ff-ab362b621038', NULL, '0ee83598-cf52-49e1-8441-2187d1bd6b5d', 'P1', '/objects/uploads/32410762-bc30-4718-9772-9ff9be0e23f8', 'Maker Makeover Music Room wardrobe R3 April 14''2026.pdf', 650627, 'application/pdf', 'current', '48688631', '2026-05-26 04:51:36'),
    ('5391f16d-2f9c-43a9-be00-cbf0437faadd', NULL, 'b187055b-8a43-470d-90e6-09228cb2617d', 'P1', '/objects/uploads/526adfce-52b7-45a8-8607-3fb00e10fe04', 'MakersMakeOver Sanjiv''s''s Room Wardrobe R2 April 02''2026.pdf', 599627, 'application/pdf', 'current', '48688631', '2026-05-26 04:52:56'),
    ('1b5dfaa4-b3f2-4793-bd9d-032df44335f0', NULL, 'a9616274-24e8-46c7-9927-3983eb2d1d7b', 'P1', '/objects/uploads/d2b8d05b-013b-40bc-8e8f-3a1cd62ff758', 'Maker MakeOver Master Bedroom Wardrobe R3 May24''2026.pdf', 2252618, 'application/pdf', 'current', '48688631', '2026-05-26 04:55:58'),
    ('4cf84541-079e-403e-bf01-25d742f602dc', NULL, '45c93708-b06d-4eae-9510-508f31452b94', 'P1', '/objects/uploads/50efb944-e7db-48f0-b113-4f8e40f80121', 'Electrical switch board R2 March 12''2026.pdf', 1585923, 'application/pdf', 'current', '48688631', '2026-05-26 05:07:03'),
    ('89bef88d-faf6-4811-afe0-4f72f19eae69', NULL, '1d6d6fdf-1a15-472a-8bd4-ac2b6cf303a7', 'P1', '/objects/uploads/64eebb4c-d0c9-4542-9b6b-a3698d04bcdb', 'Maker Makeover Cabinetry Master Bedroom TV unit Dec 08''2025.pdf', 253286, 'application/pdf', 'current', '48688631', '2026-05-26 05:37:15'),
    ('5ce73dc2-ba97-43d5-b07f-a561f69e21e9', NULL, 'a8a629d5-4f05-47d6-a7d5-7eaffa350082', 'P1', '/objects/uploads/249dc75f-e5c6-4425-9507-aa8ef839e757', 'Maker Makeover Study unit May 17''2026.pdf', 1851681, 'application/pdf', 'current', '48688631', '2026-05-26 06:33:29'),
    ('42573c14-4c6e-479f-b6c2-43cf594bab47', NULL, '1f36e23d-4e51-4e32-a0d0-2b5ab32a1d85', 'P1', '/objects/uploads/411d0f46-2b19-417b-bd07-47b10c65f785', 'Maker Makeover Chitra''s Bathroom Basin Unit May 22''2026.pdf', 890371, 'application/pdf', 'current', '48688631', '2026-05-26 06:35:38'),
    ('9c2dc349-8322-42ba-9d47-7482583e1fb4', NULL, '13cf7df6-a9dc-4696-8846-cf3685f33c46', 'P1', '/objects/uploads/f83f925c-b18f-4c0b-88fc-f87c8dc371a4', 'Maker Makeover Master Bathroom Basin Unit May 22''2026.pdf', 1115320, 'application/pdf', 'current', '48688631', '2026-05-26 06:36:16'),
    ('b5746dad-f6d5-4856-a469-bfd58ce562a8', NULL, '4c32923c-ab06-45b9-8536-1b3e77fef841', 'P1', '/objects/uploads/f78ad559-a488-4a94-b353-2babd5ecd012', 'Maker Makeover Music Basin Unit ID-109.pdf', 559796, 'application/pdf', 'current', '48688631', '2026-05-26 06:37:24'),
    ('a98b725f-08fe-4465-b1c5-0dfa73435daf', NULL, '3db58924-f8ca-41eb-bad5-b13336b18b73', 'P1', '/objects/uploads/2c4dd249-ec5f-4f8c-917e-cd087f0345c2', 'Maker Makerover Powder Basin unit  ID-110.pdf', 801173, 'application/pdf', 'current', '48688631', '2026-05-26 06:38:26'),
    ('095767a5-df20-47a0-8bc9-acbe3b0e5cec', NULL, '97414dae-0dd6-4dcc-9451-fb111b6aaec4', 'P1', '/objects/uploads/5cd856f4-1b01-438e-886d-a8698a12272b', 'Maker Makeover Living Bar Cabinet  R3 May 22''2026.pdf', 2690059, 'application/pdf', 'current', '48688631', '2026-05-26 07:31:55'),
    ('d8fefbcf-e7c2-4d05-a672-007bb0432fd3', NULL, '0109bba9-c6c2-471b-99bb-fee07c129808', 'P1', '/objects/uploads/35d1f92d-03d5-4bac-a229-5427cfb0d3cd', 'Maker Makerover Master Bathroom R-6  FEB 12''2026-ID-101 A  (1).pdf', 5451120, 'application/pdf', 'current', '48688631', '2026-05-26 07:41:08'),
    ('391c0a3c-8c4e-4faf-83e7-d155e8f963b9', NULL, 'def1f368-774e-4a4e-9849-bb7727712812', 'P1', '/objects/uploads/5a6edf93-895b-4391-8fbf-7f5e1c98aaff', 'Maker Makerover Powder Bathroom R-7  FEB 12''2026 ID-106  (1).pdf', 2853929, 'application/pdf', 'current', '48688631', '2026-05-26 07:43:39'),
    ('dab42c7c-27e5-4828-85cd-68295775e76a', NULL, 'ef649cb8-7e56-4fad-9c73-3f443487b61c', 'P1', '/objects/uploads/edcdd01d-e83d-4199-bc91-9be09f4d34fa', 'Walling Layout R4 Apr 10''2026.pdf', 726841, 'application/pdf', 'current', '48688631', '2026-05-26 07:53:02'),
    ('98d97409-879c-45ed-be9e-8c153afbec00', NULL, 'bef6888a-3202-4537-becc-773b44fe69a4', 'P2', '/objects/uploads/72b56977-4223-4ca7-833d-1ddaef518699', 'Maker MakeOver Main door & foyer panelling May 25''2026.pdf', 476977, 'application/pdf', 'current', '48688631', '2026-05-27 04:12:11'),
    ('9c56fa2e-e152-400a-a650-7c69bf4a73a9', NULL, '50cf2ce0-e963-422e-a90b-d6e2a5b40f98', 'P1', '/objects/uploads/0ff6f3ed-2644-4737-83b2-ff2ef974f1e1', 'Maker Makerover Chitra''s Bathroom R-6  FEB  14''2026ID-110  (1).pdf', 6281963, 'application/pdf', 'current', '48688631', '2026-05-27 04:18:11'),
    ('0183fe3f-1afe-4e16-a241-c1910fd99001', NULL, '0fbfbc52-a855-4f98-9c6a-81139532a718', 'P1', '/objects/uploads/c6e5c610-0d13-4f1e-81ce-72178d6da70d', 'Maker Makeover Music Bathroom R6-Feb 14''2026.pdf', 3511477, 'application/pdf', 'current', '48688631', '2026-05-27 04:58:04'),
    ('13300320-b82d-4f47-965e-0bda0f34e129', NULL, '27a23589-9b7d-4afc-951d-568f31a4ac28', 'P1', '/objects/uploads/ca9d0087-db2e-45b5-a703-36acc04bff75', 'BOM_AND_Ms. Supriya Vora_Kitchen & Utility Working Drawings_23rd April 2026 (2).pdf', 6828264, 'application/pdf', 'current', '48590680', '2026-05-27 10:59:34'),
    ('d3635c9f-d5a2-4872-9d1e-3bc6bd0eac35', NULL, 'bef0aa17-2b14-4651-85f5-a4d6a06ad7ac', 'P1', '/objects/uploads/0350656f-70dc-413b-bff0-34f6a08b4e7b', 'MAKER TOWER_FLOOR PLAN @A2 Mar 08''25.pdf', 703923, 'application/pdf', 'current', NULL, '2025-10-01 10:26:10'),
    ('c2a2f37d-37e2-4ef2-beec-09c2c8af856c', NULL, '6170de00-0b57-4a58-8107-e0394cdc2f43', 'P1', '/objects/uploads/4c8b932e-547c-45bc-8eaa-7b0b50a67c27', 'Walling plans R1 Sept 20''2025.pdf', 782754, 'application/pdf', 'current', NULL, '2025-10-20 12:08:39'),
    ('627f3058-2a7c-4778-880a-39304f1100a7', NULL, '5d612c0e-44c9-4592-8036-6fb4b9b978f7', 'P1', '/objects/uploads/10ed4c56-5ea2-4b3f-bb29-699e51dabf89', 'MASTER BATHROOM LAYOUT - 18-11-25.pdf', 325177, 'application/pdf', 'current', NULL, '2025-11-18 07:18:51'),
    ('549da8a0-4230-4713-b6ea-26d43d2cdc87', NULL, '0aaa7fa5-1662-4a3e-9014-dc864dedcf13', 'P1', '/objects/uploads/60a68bd5-bc67-443d-902b-dc5517a178ab', 'MUSIC BATHROOM - 18-11-25.pdf', 319527, 'application/pdf', 'current', NULL, '2025-11-18 07:21:35'),
    ('fbc07a83-825d-40f5-b814-7e767cb0c4bd', NULL, 'acaee2a3-8d7b-418c-9009-bfe17977973a', 'P1', '/objects/uploads/a5fa6a3d-f866-438a-813d-27c617302bd8', 'Reflected ceiling layouts Nov 19''2025.pdf', 1010367, 'application/pdf', 'current', NULL, '2025-11-20 05:45:01'),
    ('0def9528-a439-43d8-ae0f-8db16c2b4343', NULL, '19c499a7-39a5-47b3-b86a-e64c0e7ef66d', 'P1', '/objects/uploads/68e8ce15-df0a-4e22-8adb-4ebb7b98125a', 'SWITCHBOARD LAYOUT.pdf', 885966, 'application/pdf', 'current', NULL, '2025-12-09 17:59:06'),
    ('28541647-9dff-4203-a4eb-16440f02155f', NULL, '7cec255d-9006-44e6-b359-4cb9b1ae45f5', 'P1', '/objects/uploads/c540b826-783c-4877-be5c-328f9b17dd8e', 'HVAC LAYOUT.pdf', 1243308, 'application/pdf', 'current', NULL, '2025-12-09 17:59:35'),
    ('def4c497-f71f-4ed3-be0d-f0370755ef5c', NULL, '48f17629-e3d3-4f75-a581-96332ca02fdf', 'P1', '/objects/uploads/ae42eeca-c6a6-4bea-8f90-28d46b581ae0', 'FLOORING LAYOUT.pdf', 910870, 'application/pdf', 'current', NULL, '2025-12-09 18:00:09'),
    ('9d3f4875-96db-400c-8a49-5dd5545d40b6', NULL, 'b40bb863-0ff9-4c6d-a68f-59d2ebca4312', 'P1', '/objects/uploads/c94605da-de19-48f1-ab3f-dd20578c3732', 'DB WALLING LAYOUT.pdf', 565569, 'application/pdf', 'current', NULL, '2026-01-27 11:07:54'),
    ('ebb3578a-780d-4ee6-94f5-9616980205a9', NULL, '1c20ee57-560d-4369-9562-bbdb6efbc20a', 'P1', '/objects/uploads/2e9c5909-8577-4182-965a-5f553635433b', '31-01-2026 - LIGHTING LAYOUT - FOCUS LIGHTING - MAKER TOWERS 131 A.pdf', 1894813, 'application/pdf', 'current', NULL, '2026-01-31 06:49:11'),
    ('e3f5c645-a628-4f7d-b16b-074b3a641397', NULL, '5c42aa7f-800e-4bba-bb6e-6edb19f74753', 'P1', '/objects/uploads/97e2b156-6301-4df7-a1d9-64b26fe961ca', '26-03-2026 - Light Measurement layout - Maker Towers - 131 A.pdf', 1753271, 'application/pdf', 'current', NULL, '2026-03-27 09:16:08')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO revision_events (id, org_id, revision_id, event_type, actor_id, created_at) VALUES
    ('3d989c0f-9003-4803-a745-a93efa71a07c', NULL, '3eb56ea5-1ed2-413c-9e59-682cf2008191', 'uploaded', NULL, '2025-11-20 05:25:57'),
    ('b25dc650-e0c6-4911-8bbc-67dd27c79f54', NULL, '03b84a7c-51b9-4dea-bd03-3d547889ac3c', 'uploaded', NULL, '2025-12-22 12:49:32'),
    ('66fd27dc-77a0-4ea4-bcf8-7c573f7fcaa3', NULL, 'edb69429-37aa-4c5a-9f00-9afc809d43f6', 'uploaded', NULL, '2025-12-22 12:50:31'),
    ('587ec8a3-fdbe-4b32-9e19-1909ff8d9a45', NULL, '5fa20376-88d0-4bab-8c94-b94f565a0704', 'uploaded', NULL, '2025-12-23 07:03:24'),
    ('1389f628-895e-4266-b2dc-23f7f278eb85', NULL, 'd7d7ceaa-8f61-4bc4-8f74-bed13cadae0b', 'uploaded', NULL, '2025-12-24 05:23:03'),
    ('11f4eb38-25e2-4548-998f-4dabf1ae7618', NULL, 'f47cf192-616f-40e4-8114-a21048862b56', 'uploaded', '48688631', '2026-03-05 06:51:36'),
    ('98534cd6-2fa9-42a8-a094-8fb8df591c32', NULL, 'd5577519-ac98-42b4-8d74-a97c1c913e49', 'uploaded', '48688631', '2026-03-05 06:53:39'),
    ('627a1323-ebc3-41ea-92da-6ec564e478b5', NULL, '52acfea6-05e7-4c45-ae6c-25f7208d4411', 'uploaded', '48688631', '2026-03-05 08:02:52'),
    ('488d9ded-1564-4ed7-a460-28aad83f3bc5', NULL, 'c9f7e520-cb82-4c86-bd72-2e8d2d92f02d', 'uploaded', '48590680', '2026-04-23 07:29:01'),
    ('bb1b2b78-4e83-4f22-b35c-c40303eec714', NULL, '5c9094a0-2429-430a-869b-c104e9009230', 'uploaded', '48590680', '2026-05-02 13:05:49'),
    ('0bec3442-6778-4927-bbe7-1c1474d59f75', NULL, 'e8add3a9-08f3-4c60-8fa6-5846d897c7fc', 'uploaded', '48688631', '2026-05-06 15:35:21'),
    ('07fff83d-4768-49bf-b765-fa84cab2463c', NULL, '435d2bcd-a7db-4d63-830d-8a6565687e09', 'uploaded', '48590680', '2026-05-22 08:48:30'),
    ('2bb385fd-6825-451b-9ced-25f375646d92', NULL, 'aef1f591-56a3-44d6-965a-5508fef4d5bc', 'uploaded', '48688631', '2026-05-25 09:22:19'),
    ('5f1799ff-77ff-42ca-ab83-aa7588900dc0', NULL, 'e4ae5aef-fce8-4ec9-b7cb-20a434a4a5e6', 'uploaded', '48688631', '2026-05-25 09:23:08'),
    ('66a3d70a-6ca8-4e5f-8e38-791a098a6f4c', NULL, '5f0a79c2-3b8c-41ee-a9e8-09840332b1aa', 'uploaded', '48688631', '2026-05-26 04:49:19'),
    ('7ae5930a-483f-473d-affd-09cc608238da', NULL, 'b692fb03-1ccc-4a93-91ff-ab362b621038', 'uploaded', '48688631', '2026-05-26 04:51:36'),
    ('9eda9e29-c9ee-449c-8f74-705e54faa2f6', NULL, '5391f16d-2f9c-43a9-be00-cbf0437faadd', 'uploaded', '48688631', '2026-05-26 04:52:56'),
    ('b8fb80e0-dd70-4dbd-b659-784bad90296b', NULL, '1b5dfaa4-b3f2-4793-bd9d-032df44335f0', 'uploaded', '48688631', '2026-05-26 04:55:58'),
    ('6202fc1f-2ca8-44ab-af9e-cedf87404e07', NULL, '4cf84541-079e-403e-bf01-25d742f602dc', 'uploaded', '48688631', '2026-05-26 05:07:03'),
    ('f47aaa8d-0c32-4a19-ac52-abe763335c60', NULL, '89bef88d-faf6-4811-afe0-4f72f19eae69', 'uploaded', '48688631', '2026-05-26 05:37:15'),
    ('09b0cc8a-3f3f-4762-9319-607c84acde4c', NULL, '5ce73dc2-ba97-43d5-b07f-a561f69e21e9', 'uploaded', '48688631', '2026-05-26 06:33:29'),
    ('45968e6f-cffd-40e9-96a8-fa0722190b1d', NULL, '42573c14-4c6e-479f-b6c2-43cf594bab47', 'uploaded', '48688631', '2026-05-26 06:35:38'),
    ('d19ebbe3-39cc-4c4f-80dc-40716c33a868', NULL, '9c2dc349-8322-42ba-9d47-7482583e1fb4', 'uploaded', '48688631', '2026-05-26 06:36:16'),
    ('58bfd33e-2c6f-4524-8841-1787c0f570a2', NULL, 'b5746dad-f6d5-4856-a469-bfd58ce562a8', 'uploaded', '48688631', '2026-05-26 06:37:24'),
    ('2dd1b20d-f634-4cb9-a246-593128185251', NULL, 'a98b725f-08fe-4465-b1c5-0dfa73435daf', 'uploaded', '48688631', '2026-05-26 06:38:26'),
    ('a1a7cf6d-46e8-4a70-a99a-dd5b4d8e12c7', NULL, '095767a5-df20-47a0-8bc9-acbe3b0e5cec', 'uploaded', '48688631', '2026-05-26 07:31:55'),
    ('0c9a2263-e064-4708-b558-c8fd0df6b7b8', NULL, 'd8fefbcf-e7c2-4d05-a672-007bb0432fd3', 'uploaded', '48688631', '2026-05-26 07:41:08'),
    ('80182df3-2936-48f8-a770-9373413ae17c', NULL, '391c0a3c-8c4e-4faf-83e7-d155e8f963b9', 'uploaded', '48688631', '2026-05-26 07:43:39'),
    ('57bbc24c-45c9-44a8-ad3e-f333acc23f3d', NULL, 'dab42c7c-27e5-4828-85cd-68295775e76a', 'uploaded', '48688631', '2026-05-26 07:53:02'),
    ('b6f84b2a-c221-420c-928c-9a28c64cd6ba', NULL, '98d97409-879c-45ed-be9e-8c153afbec00', 'uploaded', '48688631', '2026-05-27 04:12:11'),
    ('3129075d-13f4-4f57-b3be-8576eb21f2ed', NULL, '9c56fa2e-e152-400a-a650-7c69bf4a73a9', 'uploaded', '48688631', '2026-05-27 04:18:11'),
    ('98375d85-31af-4267-a241-ba972b91003d', NULL, '0183fe3f-1afe-4e16-a241-c1910fd99001', 'uploaded', '48688631', '2026-05-27 04:58:04'),
    ('cb298e38-23ec-4f49-90bf-b1a90c99138d', NULL, '13300320-b82d-4f47-965e-0bda0f34e129', 'uploaded', '48590680', '2026-05-27 10:59:34'),
    ('6c70351a-f1c6-431b-8fea-ee7ea11a6368', NULL, 'd3635c9f-d5a2-4872-9d1e-3bc6bd0eac35', 'uploaded', NULL, '2025-10-01 10:26:10'),
    ('236f9975-3e00-4ce3-a78a-de97473e6c23', NULL, 'c2a2f37d-37e2-4ef2-beec-09c2c8af856c', 'uploaded', NULL, '2025-10-20 12:08:39'),
    ('47beaa92-aea0-4dc4-bd2b-6adb491f53c9', NULL, '627f3058-2a7c-4778-880a-39304f1100a7', 'uploaded', NULL, '2025-11-18 07:18:51'),
    ('32bb75b5-67cf-4d7d-a7b3-e4705ef516c1', NULL, '549da8a0-4230-4713-b6ea-26d43d2cdc87', 'uploaded', NULL, '2025-11-18 07:21:35'),
    ('96e8606c-a53d-45d9-b3a3-d9f26ffa1077', NULL, 'fbc07a83-825d-40f5-b814-7e767cb0c4bd', 'uploaded', NULL, '2025-11-20 05:45:01'),
    ('bfe92528-0961-45e1-bb91-3613cb81c33b', NULL, '0def9528-a439-43d8-ae0f-8db16c2b4343', 'uploaded', NULL, '2025-12-09 17:59:06'),
    ('a4f4336e-51a7-4632-8175-280f8edeb529', NULL, '28541647-9dff-4203-a4eb-16440f02155f', 'uploaded', NULL, '2025-12-09 17:59:35'),
    ('41079410-86ad-4f1f-a82a-1759a24b767e', NULL, 'def4c497-f71f-4ed3-be0d-f0370755ef5c', 'uploaded', NULL, '2025-12-09 18:00:09'),
    ('a2eef30f-2597-4162-a175-f4bef27b2766', NULL, '9d3f4875-96db-400c-8a49-5dd5545d40b6', 'uploaded', NULL, '2026-01-27 11:07:54'),
    ('cbf94386-e906-42b7-a02a-bab38b9c0a06', NULL, 'ebb3578a-780d-4ee6-94f5-9616980205a9', 'uploaded', NULL, '2026-01-31 06:49:11'),
    ('9e5335ab-3b0b-48c0-a921-e0555c06ee96', NULL, 'e3f5c645-a628-4f7d-b16b-074b3a641397', 'uploaded', NULL, '2026-03-27 09:16:08')
  ON CONFLICT (id) DO NOTHING;

END $$;