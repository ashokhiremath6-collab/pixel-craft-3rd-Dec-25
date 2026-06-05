-- 0012_seed_maker_tower_working_drawings.sql
  -- Seeds 12 rooms + 43 drawings (44 revisions) for Maker Tower (Hiremath Interiors).
  -- Sources: 33 moodboards WHERE asset_type='working_drawing' + 11 floor_plans.
  -- Guard: only runs if Hiremath org exists and Maker Tower has no drawings yet.
  -- Idempotent: safe to re-run (DO block exits early if drawings already exist).

  DO $$
  BEGIN
    -- Guard: only seed in environments where Hiremath Interiors org + Maker Tower project exist
    -- and no drawings have been loaded yet.
    IF NOT EXISTS (
      SELECT 1 FROM organisations WHERE id = 'cc05b280-74c7-4e9a-ae92-3d5a50207b07'
    ) THEN RETURN; END IF;

    IF EXISTS (
      SELECT 1 FROM drawings WHERE project_id = '2de39e0d-ec50-4426-9b9e-69b6868409b0' LIMIT 1
    ) THEN RETURN; END IF;

    -- ── ROOMS ─────────────────────────────────────────────────────────────
    INSERT INTO rooms (id, org_id, project_id, name, room_type, display_order, created_at, updated_at)
    VALUES
      ('4ae4fbd7-3045-4eeb-b78d-748380f4f6ba','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Master Bedroom','bedroom',1,NOW(),NOW()),
    ('e0733d55-c74f-471f-bc0f-4591fa72f700','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Master Bathroom','bathroom',2,NOW(),NOW()),
    ('6cf86e94-73db-4707-bc3e-1a3cbf6fe342','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Music Room','other',3,NOW(),NOW()),
    ('a0f285c4-2bbb-4220-ab3c-1cd01c653b2b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Music Bathroom','bathroom',4,NOW(),NOW()),
    ('227c4b86-a66e-4b2d-972d-a642051ec506','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Powder Bathroom','bathroom',5,NOW(),NOW()),
    ('b4fd9397-1529-4ae3-a20a-3a51ef4d8c92','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Kitchen','kitchen',6,NOW(),NOW()),
    ('ec297c43-dfa5-4853-ad37-929f73d84bed','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Internal Foyer','other',7,NOW(),NOW()),
    ('6a42d0d9-9bdc-4f2e-a193-e1287366e67f','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Living Room','other',8,NOW(),NOW()),
    ('a7820aff-2084-403c-9ba1-449f7ce12c41','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Chitra''s Bedroom','bedroom',9,NOW(),NOW()),
    ('9615d5dc-3906-42a4-aca7-1f5642717c2d','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Chitra''s Bathroom','bathroom',10,NOW(),NOW()),
    ('6cf49022-6dec-4a5d-9867-bf5dc5f1faae','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Study','other',11,NOW(),NOW()),
    ('a55fe383-5eb0-4ba8-9aa2-0939bf4568ea','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','Sanjiv''s Bedroom','bedroom',12,NOW(),NOW())
    ON CONFLICT DO NOTHING;

    -- ── DRAWINGS ──────────────────────────────────────────────────────────
    INSERT INTO drawings (id, org_id, project_id, room_id, title, category, discipline, status, is_template_placeholder, created_at, updated_at)
    VALUES
      ('4777a53b-b5bf-4857-a3ad-c42cc27c9c0c','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','6cf86e94-73db-4707-bc3e-1a3cbf6fe342','Sanket for Acoustic Document','Specification','Interior','approved',false,NOW(),NOW()),
    ('877292e3-8fa8-4c2b-ace9-a6716b017412','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Automation Layouts - Black Hawk','Electrical Layout','Interior','approved',false,NOW(),NOW()),
    ('eb523ef7-fd48-46f5-9751-4f8cecf3b060','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Electrical Switchboard E-101','Electrical Layout','Interior','approved',false,NOW(),NOW()),
    ('bd325d5b-aab3-44ca-bffb-5268b736432c','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Electrical Switchboard E-102','Electrical Layout','Interior','approved',false,NOW(),NOW()),
    ('0b5042f7-caa5-4fe9-af1e-af27007fc991','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Bathroom Cabinet & Counter References','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('711ad568-9527-40e5-b4f9-4d838df2305b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','a0f285c4-2bbb-4220-ab3c-1cd01c653b2b','Music Bathroom Joinery R6','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('5a1481bb-6bc4-4d91-9d93-3cf1d470e2d8','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','9615d5dc-3906-42a4-aca7-1f5642717c2d','Chitra''s Bathroom Joinery R-6','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('d9b91111-d3c1-4bd4-a5b9-de36b221244d','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','e0733d55-c74f-471f-bc0f-4591fa72f700','Master Bathroom Joinery R-6','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('324ded85-efec-405b-9f17-6dcce2d4f978','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','227c4b86-a66e-4b2d-972d-a642051ec506','Powder Bathroom Joinery R-7','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('0fc4d974-f3db-4cf1-b2dd-581b3fa713c5','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','ec297c43-dfa5-4853-ad37-929f73d84bed','Foyer Elevations','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('f7001b6e-61ba-4823-aefe-8a0446b78d0b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','ec297c43-dfa5-4853-ad37-929f73d84bed','Main Door & Foyer Panelling','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('ef328aa0-70f9-4d38-ae15-f56101032b09','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','4ae4fbd7-3045-4eeb-b78d-748380f4f6ba','Master Bedroom TV Unit Cabinetry','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('7b94e84c-3a83-4bd1-a017-02d1f924d83e','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','9615d5dc-3906-42a4-aca7-1f5642717c2d','Chitra''s Bathroom Basin Unit','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('e3928a18-3321-4391-9c57-20bdd301f91b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','6a42d0d9-9bdc-4f2e-a193-e1287366e67f','Living Bar Cabinet R3','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('dfa0287d-a7ff-4f0a-91b9-7e0287c64b44','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','e0733d55-c74f-471f-bc0f-4591fa72f700','Master Bathroom Basin Unit','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('8162ac3e-cf97-413e-b3b7-1136da5845cd','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','a0f285c4-2bbb-4220-ab3c-1cd01c653b2b','Music Bathroom Basin Unit','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('b679a193-bb2d-4343-ba04-ffb2f06bb723','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','6cf49022-6dec-4a5d-9867-bf5dc5f1faae','Study Unit Joinery','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('48bb0979-ac6f-4652-a9d4-33f398827f00','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Door Joinery','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('2d88378a-3f9b-4e45-b40e-e56c408f865b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','227c4b86-a66e-4b2d-972d-a642051ec506','Powder Bathroom Basin Unit','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('28745cbd-2d5c-4889-bde6-8a527e4cdf57','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','ec297c43-dfa5-4853-ad37-929f73d84bed','Foyer Reflected Ceiling Layout','Reflected Ceiling Plan','Interior','approved',false,NOW(),NOW()),
    ('b9cc7a85-2445-412f-b2ea-115b2880fa3d','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Electrical Switchboard R2','Electrical Layout','Interior','approved',false,NOW(),NOW()),
    ('86eb0931-b88b-4584-adbb-a7e13f91e3e2','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','b4fd9397-1529-4ae3-a20a-3a51ef4d8c92','Kitchen Section','Elevation','Interior','approved',false,NOW(),NOW()),
    ('38812f7d-11bb-4928-8465-2900f5d4ef07','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','6cf86e94-73db-4707-bc3e-1a3cbf6fe342','Music Room Console','Elevation','Interior','approved',false,NOW(),NOW()),
    ('7bcb97c1-8055-4b96-8472-cefe96be66de','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Window Jamb Moulding & Pelmet Detail','Elevation','Interior','approved',false,NOW(),NOW()),
    ('0aabb1af-6d23-409c-bd5d-f4c75e50558e','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Walling Layout R4','Floor Plan','Interior','approved',false,NOW(),NOW()),
    ('a5b27cf1-06c7-455a-b16f-95182b21500b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Flooring Layout (Dec 24)','Finishes Schedule','Interior','approved',false,NOW(),NOW()),
    ('6b8366bc-a856-4a45-9ae6-6077b654b897','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','b4fd9397-1529-4ae3-a20a-3a51ef4d8c92','Kitchen Flooring Layout','Finishes Schedule','Interior','approved',false,NOW(),NOW()),
    ('6d84e571-0687-4d08-8090-dabe49acaadd','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','b4fd9397-1529-4ae3-a20a-3a51ef4d8c92','Kitchen & Utility Working Drawings','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('0e10ed1e-73c3-42b0-bd3e-17d648312d73','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','a7820aff-2084-403c-9ba1-449f7ce12c41','Chitra''s Bedroom Wardrobe R3','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('198ef70c-855e-4402-94ed-7c8d558a8b0f','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','4ae4fbd7-3045-4eeb-b78d-748380f4f6ba','Master Bedroom Wardrobe R3','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('ccae51c1-6486-47ff-b8df-8e2bfbd2522b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','6cf86e94-73db-4707-bc3e-1a3cbf6fe342','Music Room Wardrobe R3','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('fcd30047-fc20-4ed7-bfc3-10ca9f36c5a3','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','a55fe383-5eb0-4ba8-9aa2-0939bf4568ea','Sanjiv''s Bedroom Wardrobe R2','Joinery Detail','Interior','approved',false,NOW(),NOW()),
    ('1ed02dcf-2d85-401f-be9a-dfc91d5869f2','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'DB Walling Layout','Floor Plan','Interior','approved',false,NOW(),NOW()),
    ('dfb36495-333d-40e8-a7ab-386921d86090','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Flooring Layout (Dec 09)','Finishes Schedule','Interior','approved',false,NOW(),NOW()),
    ('e85d7ee9-4d21-48f8-8a76-10c22b0e16d3','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'HVAC Layout','HVAC Layout','Interior','approved',false,NOW(),NOW()),
    ('4bf5a49e-700f-487c-9339-f90ae3718fd1','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Lighting Layout - Focus Lighting','Electrical Layout','Interior','approved',false,NOW(),NOW()),
    ('d9f8e31f-d91e-4251-963b-d26d55f668ee','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Light Measurement Layout','Electrical Layout','Interior','approved',false,NOW(),NOW()),
    ('1c587cd4-bf4c-48d4-824b-9359a3fba594','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','e0733d55-c74f-471f-bc0f-4591fa72f700','Master Bathroom Floor Plan','Floor Plan','Interior','approved',false,NOW(),NOW()),
    ('985bef8b-3ba1-4503-9b20-343363f7ff48','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0','a0f285c4-2bbb-4220-ab3c-1cd01c653b2b','Music Bathroom Floor Plan','Floor Plan','Interior','approved',false,NOW(),NOW()),
    ('e787d8d4-f36e-4277-b7ed-4d2410160632','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Maker Tower Floor Plan','Floor Plan','Interior','approved',false,NOW(),NOW()),
    ('cd36d389-76ba-4f3d-a994-40fc14872d6b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'RCP Layout','Reflected Ceiling Plan','Interior','approved',false,NOW(),NOW()),
    ('3f2f3ccc-046b-44a6-8df8-70966113e9ac','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Switchboard Layout','Electrical Layout','Interior','approved',false,NOW(),NOW()),
    ('6ee66453-5703-4a95-b74c-b22af1748aba','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2de39e0d-ec50-4426-9b9e-69b6868409b0',NULL,'Walling Layout R1','Floor Plan','Interior','approved',false,NOW(),NOW())
    ON CONFLICT DO NOTHING;

    -- ── DRAWING REVISIONS ─────────────────────────────────────────────────
    -- Columns: id, org_id, drawing_id, revision_letter, file_path, file_name,
    --          file_size, file_mime_type, state, uploaded_by, uploaded_at, approved_at, superseded_at
    INSERT INTO drawing_revisions (id, org_id, drawing_id, revision_letter, file_path, file_name, file_size, file_mime_type, state, uploaded_by, uploaded_at, approved_at, superseded_at)
    VALUES
      ('d3eb17a5-a24c-47ff-ad83-cce164aedad8','cc05b280-74c7-4e9a-ae92-3d5a50207b07','4777a53b-b5bf-4857-a3ad-c42cc27c9c0c','A','/objects/uploads/a4e2be5f-8ea6-43e1-930a-19cfd19851e5','Sanket for acoustic docment .pdf',3575274,'application/pdf','approved',NULL,'2025-11-20 05:25:57','2025-11-20 05:25:57',NULL),
    ('27598086-203f-4ae6-8211-b15fa9feecd9','cc05b280-74c7-4e9a-ae92-3d5a50207b07','877292e3-8fa8-4c2b-ace9-a6716b017412','A','/objects/uploads/5fb1f9b1-c311-442b-9a34-b166f8fea3e4','23-12-2025 AUTOMATION LAYOUTS -  BLACK HAWK.pdf',3133351,'application/pdf','approved',NULL,'2025-12-23 07:03:24','2025-12-23 07:03:24',NULL),
    ('c57153f4-9a65-4e5b-bae9-1e7763fa70a6','cc05b280-74c7-4e9a-ae92-3d5a50207b07','eb523ef7-fd48-46f5-9751-4f8cecf3b060','A','/objects/uploads/8e1b3a6e-d17f-4e3f-b225-0e34d2fd22fa','Electrical Switch board E-101 Dec 21''2025.pdf',925665,'application/pdf','approved',NULL,'2025-12-22 12:50:31','2025-12-22 12:50:31',NULL),
    ('3b647116-1eff-49a1-8684-82d3da97d2ae','cc05b280-74c7-4e9a-ae92-3d5a50207b07','bd325d5b-aab3-44ca-bffb-5268b736432c','A','/objects/uploads/4736ab43-9bd4-4ca3-a2a7-f6b93a4d34ef','Electrical Switch board E-102 Dec 21''2025.pdf',603435,'application/pdf','approved',NULL,'2025-12-22 12:49:32','2025-12-22 12:49:32',NULL),
    ('300f6f58-5566-4c9f-a929-905666118188','cc05b280-74c7-4e9a-ae92-3d5a50207b07','0b5042f7-caa5-4fe9-af1e-af27007fc991','A','/objects/uploads/cc017707-4734-42e4-b7a0-ae70bb12dbb7','BATHROOM CABINET & COUNTER REFERENCES  .pdf',1834501,'application/pdf','approved','48590680','2026-05-22 08:48:30','2026-05-22 08:48:30',NULL),
    ('42dc9ad4-5d87-4fe9-b381-614ececf7004','cc05b280-74c7-4e9a-ae92-3d5a50207b07','711ad568-9527-40e5-b4f9-4d838df2305b','A','/objects/uploads/c6e5c610-0d13-4f1e-81ce-72178d6da70d','Maker Makeover Music Bathroom R6-Feb 14''2026.pdf',3511477,'application/pdf','approved','48688631','2026-05-27 04:58:04','2026-05-27 04:58:04',NULL),
    ('6567656f-db33-4be0-a9f4-967194372e9f','cc05b280-74c7-4e9a-ae92-3d5a50207b07','5a1481bb-6bc4-4d91-9d93-3cf1d470e2d8','A','/objects/uploads/0ff6f3ed-2644-4737-83b2-ff2ef974f1e1','Maker Makerover Chitra''s Bathroom R-6  FEB  14''2026ID-110  (1).pdf',6281963,'application/pdf','approved','48688631','2026-05-27 04:18:11','2026-05-27 04:18:11',NULL),
    ('558ecfb9-72a9-4217-9536-ee623d711978','cc05b280-74c7-4e9a-ae92-3d5a50207b07','d9b91111-d3c1-4bd4-a5b9-de36b221244d','A','/objects/uploads/35d1f92d-03d5-4bac-a229-5427cfb0d3cd','Maker Makerover Master Bathroom R-6  FEB 12''2026-ID-101 A  (1).pdf',5451120,'application/pdf','approved','48688631','2026-05-26 07:41:08','2026-05-26 07:41:08',NULL),
    ('13627eae-abfd-4e28-a086-fced991c2fd2','cc05b280-74c7-4e9a-ae92-3d5a50207b07','324ded85-efec-405b-9f17-6dcce2d4f978','A','/objects/uploads/5a6edf93-895b-4391-8fbf-7f5e1c98aaff','Maker Makerover Powder Bathroom R-7  FEB 12''2026 ID-106  (1).pdf',2853929,'application/pdf','approved','48688631','2026-05-26 07:43:39','2026-05-26 07:43:39',NULL),
    ('f18c2aa5-22c7-4efa-943a-04896c4bd969','cc05b280-74c7-4e9a-ae92-3d5a50207b07','0fc4d974-f3db-4cf1-b2dd-581b3fa713c5','A','/objects/uploads/9d08e517-b021-4f5b-8506-333b045198d9','23-04-2026 - Foyer elevations _ Maker Towers 131 A.pdf',1028685,'application/pdf','approved','48590680','2026-04-23 07:29:01','2026-04-23 07:29:01',NULL),
    ('fac4ae14-91a8-4cda-90c1-60cc0fedd146','cc05b280-74c7-4e9a-ae92-3d5a50207b07','f7001b6e-61ba-4823-aefe-8a0446b78d0b','A','/objects/uploads/52bd198d-831d-4750-81a2-afc7096df0eb','Maker MakeOver Main door & foyer panelling May 25''2026.pdf',445328,'application/pdf','superseded','48688631','2026-05-25 09:22:19',NULL,'2026-05-27 04:12:11'),
    ('afc23e61-ba45-43c2-aaab-1ae6a8a0f74d','cc05b280-74c7-4e9a-ae92-3d5a50207b07','f7001b6e-61ba-4823-aefe-8a0446b78d0b','B','/objects/uploads/72b56977-4223-4ca7-833d-1ddaef518699','Maker MakeOver Main door & foyer panelling May 25''2026.pdf',476977,'application/pdf','approved','48688631','2026-05-27 04:12:11','2026-05-27 04:12:11',NULL),
    ('99f27ed4-1d95-4ded-bc68-7db871bba427','cc05b280-74c7-4e9a-ae92-3d5a50207b07','ef328aa0-70f9-4d38-ae15-f56101032b09','A','/objects/uploads/64eebb4c-d0c9-4542-9b6b-a3698d04bcdb','Maker Makeover Cabinetry Master Bedroom TV unit Dec 08''2025.pdf',253286,'application/pdf','approved','48688631','2026-05-26 05:37:15','2026-05-26 05:37:15',NULL),
    ('f05ffd11-83b1-4b54-b7f0-96a5cb3ed202','cc05b280-74c7-4e9a-ae92-3d5a50207b07','7b94e84c-3a83-4bd1-a017-02d1f924d83e','A','/objects/uploads/411d0f46-2b19-417b-bd07-47b10c65f785','Maker Makeover Chitra''s Bathroom Basin Unit May 22''2026.pdf',890371,'application/pdf','approved','48688631','2026-05-26 06:35:38','2026-05-26 06:35:38',NULL),
    ('732f3f7a-1130-492b-b05c-791ae4405e20','cc05b280-74c7-4e9a-ae92-3d5a50207b07','e3928a18-3321-4391-9c57-20bdd301f91b','A','/objects/uploads/5cd856f4-1b01-438e-886d-a8698a12272b','Maker Makeover Living Bar Cabinet  R3 May 22''2026.pdf',2690059,'application/pdf','approved','48688631','2026-05-26 07:31:55','2026-05-26 07:31:55',NULL),
    ('a00cb408-ccf5-4731-afa2-9edfebb6e325','cc05b280-74c7-4e9a-ae92-3d5a50207b07','dfa0287d-a7ff-4f0a-91b9-7e0287c64b44','A','/objects/uploads/f83f925c-b18f-4c0b-88fc-f87c8dc371a4','Maker Makeover Master Bathroom Basin Unit May 22''2026.pdf',1115320,'application/pdf','approved','48688631','2026-05-26 06:36:16','2026-05-26 06:36:16',NULL),
    ('0dd1bfe9-5527-4b57-b044-2116bad37421','cc05b280-74c7-4e9a-ae92-3d5a50207b07','8162ac3e-cf97-413e-b3b7-1136da5845cd','A','/objects/uploads/f78ad559-a488-4a94-b353-2babd5ecd012','Maker Makeover Music Basin Unit ID-109.pdf',559796,'application/pdf','approved','48688631','2026-05-26 06:37:24','2026-05-26 06:37:24',NULL),
    ('e8410623-1f0a-4b3a-98ed-a48eca47f040','cc05b280-74c7-4e9a-ae92-3d5a50207b07','b679a193-bb2d-4343-ba04-ffb2f06bb723','A','/objects/uploads/249dc75f-e5c6-4425-9507-aa8ef839e757','Maker Makeover Study unit May 17''2026.pdf',1851681,'application/pdf','approved','48688631','2026-05-26 06:33:29','2026-05-26 06:33:29',NULL),
    ('06282678-8e4f-4b3f-9c35-bcc385c1521f','cc05b280-74c7-4e9a-ae92-3d5a50207b07','48bb0979-ac6f-4652-a9d4-33f398827f00','A','/objects/uploads/4ac23ff3-e837-4f0d-b42a-7b2670ac3684','Maker Makerover Door Dec 08''2025 .pdf',5045455,'application/pdf','approved','48688631','2026-03-05 06:51:36','2026-03-05 06:51:36',NULL),
    ('ed6700e2-522d-47d1-8679-a32cbf7228ce','cc05b280-74c7-4e9a-ae92-3d5a50207b07','2d88378a-3f9b-4e45-b40e-e56c408f865b','A','/objects/uploads/2c4dd249-ec5f-4f8c-917e-cd087f0345c2','Maker Makerover Powder Basin unit  ID-110.pdf',801173,'application/pdf','approved','48688631','2026-05-26 06:38:26','2026-05-26 06:38:26',NULL),
    ('cd330aad-0054-4c6e-a28f-fbdcbf5a8bc8','cc05b280-74c7-4e9a-ae92-3d5a50207b07','28745cbd-2d5c-4889-bde6-8a527e4cdf57','A','/objects/uploads/709ad41a-0404-4107-bf17-24db25438939','Reflected ceiling layout Foyer May 25''2026.pdf',722873,'application/pdf','approved','48688631','2026-05-25 09:23:08','2026-05-25 09:23:08',NULL),
    ('1f2f1599-7f8e-4ba9-97ae-390a92c899e2','cc05b280-74c7-4e9a-ae92-3d5a50207b07','b9cc7a85-2445-412f-b2ea-115b2880fa3d','A','/objects/uploads/50efb944-e7db-48f0-b113-4f8e40f80121','Electrical switch board R2 March 12''2026.pdf',1585923,'application/pdf','approved','48688631','2026-05-26 05:07:03','2026-05-26 05:07:03',NULL),
    ('70d4d5f1-c537-4669-9fe8-325da0823618','cc05b280-74c7-4e9a-ae92-3d5a50207b07','86eb0931-b88b-4584-adbb-a7e13f91e3e2','A','/objects/uploads/c8065793-dd83-4fd2-9e2e-3b6a9041975b','Maker Makeover Kitchen Section Feb 17''2026.pdf',1253232,'application/pdf','approved','48688631','2026-03-05 06:53:39','2026-03-05 06:53:39',NULL),
    ('b77fc7fb-b27f-4ab3-8457-e4b4611b0210','cc05b280-74c7-4e9a-ae92-3d5a50207b07','38812f7d-11bb-4928-8465-2900f5d4ef07','A','/objects/uploads/cba38214-31d9-4e6f-b29c-87deeb66571f','Music room console internal working drawing.pdf',294460,'application/pdf','approved','48590680','2026-05-02 13:05:49','2026-05-02 13:05:49',NULL),
    ('d7bb13f8-2341-4d62-b8b6-1265e3b1c502','cc05b280-74c7-4e9a-ae92-3d5a50207b07','7bcb97c1-8055-4b96-8472-cefe96be66de','A','/objects/uploads/8a66989d-9d63-449b-b352-6edd9ca75f7f','Window jamb moulding pelmet skirting detail Dec 27''2025.pdf',823662,'application/pdf','approved','48688631','2026-03-05 08:02:52','2026-03-05 08:02:52',NULL),
    ('e7dff807-bce7-48fd-92b9-d5e51b9a5ec5','cc05b280-74c7-4e9a-ae92-3d5a50207b07','0aabb1af-6d23-409c-bd5d-f4c75e50558e','A','/objects/uploads/edcdd01d-e83d-4199-bc91-9be09f4d34fa','Walling Layout R4 Apr 10''2026.pdf',726841,'application/pdf','approved','48688631','2026-05-26 07:53:02','2026-05-26 07:53:02',NULL),
    ('c8168e76-fa6d-46b9-8c5f-44521f4eb01d','cc05b280-74c7-4e9a-ae92-3d5a50207b07','a5b27cf1-06c7-455a-b16f-95182b21500b','A','/objects/uploads/ae6b274f-f76a-406f-b509-7b760faf71e4','Flooring Layout - 24-12-25.pdf',918191,'application/pdf','approved',NULL,'2025-12-24 05:23:03','2025-12-24 05:23:03',NULL),
    ('e8479471-ed2c-43bd-86b4-bf1e54f5802d','cc05b280-74c7-4e9a-ae92-3d5a50207b07','6b8366bc-a856-4a45-9ae6-6077b654b897','A','/objects/uploads/e1d3a799-0183-4cce-920e-d5bd50b9573d','Maker Makeover Kitchen flooring May 06''2026.pdf',945794,'application/pdf','approved','48688631','2026-05-06 15:35:16','2026-05-06 15:35:16',NULL),
    ('f72711b1-0cf4-42d2-8c38-ef361b1985bf','cc05b280-74c7-4e9a-ae92-3d5a50207b07','6d84e571-0687-4d08-8090-dabe49acaadd','A','/objects/uploads/ca9d0087-db2e-45b5-a703-36acc04bff75','BOM_AND_Ms. Supriya Vora_Kitchen & Utility Working Drawings_23rd April 2026 (2).pdf',6828264,'application/pdf','approved','48590680','2026-05-27 10:59:34','2026-05-27 10:59:34',NULL),
    ('d843e289-d9b6-40be-80e3-8b34c84a6902','cc05b280-74c7-4e9a-ae92-3d5a50207b07','0e10ed1e-73c3-42b0-bd3e-17d648312d73','A','/objects/uploads/98687b1f-dc7a-4702-9699-2a685283b3ae','Maker MakeOver Chitra''s Room Wardrobe R3 May 24''2026.pdf',527127,'application/pdf','approved','48688631','2026-05-26 04:49:19','2026-05-26 04:49:19',NULL),
    ('ac679b2e-f79a-48ed-8134-e1c21b4566a8','cc05b280-74c7-4e9a-ae92-3d5a50207b07','198ef70c-855e-4402-94ed-7c8d558a8b0f','A','/objects/uploads/d2b8d05b-013b-40bc-8e8f-3a1cd62ff758','Maker MakeOver Master Bedroom Wardrobe R3 May24''2026.pdf',2252618,'application/pdf','approved','48688631','2026-05-26 04:55:58','2026-05-26 04:55:58',NULL),
    ('be378b3e-2570-4d74-95be-d08b4034fef4','cc05b280-74c7-4e9a-ae92-3d5a50207b07','ccae51c1-6486-47ff-b8df-8e2bfbd2522b','A','/objects/uploads/32410762-bc30-4718-9772-9ff9be0e23f8','Maker Makeover Music Room wardrobe R3 April 14''2026.pdf',650627,'application/pdf','approved','48688631','2026-05-26 04:51:36','2026-05-26 04:51:36',NULL),
    ('d71b136c-0d14-4c28-bef4-573687f1afc7','cc05b280-74c7-4e9a-ae92-3d5a50207b07','fcd30047-fc20-4ed7-bfc3-10ca9f36c5a3','A','/objects/uploads/526adfce-52b7-45a8-8607-3fb00e10fe04','MakersMakeOver Sanjiv''s''s Room Wardrobe R2 April 02''2026.pdf',599627,'application/pdf','approved','48688631','2026-05-26 04:52:56','2026-05-26 04:52:56',NULL),
    ('ec0afe74-906b-4a2d-93d1-862c0147a475','cc05b280-74c7-4e9a-ae92-3d5a50207b07','1ed02dcf-2d85-401f-be9a-dfc91d5869f2','A','/objects/uploads/c94605da-de19-48f1-ab3f-dd20578c3732','DB WALLING LAYOUT.pdf',565569,'application/pdf','approved',NULL,'2026-01-27 11:07:54','2026-01-27 11:07:54',NULL),
    ('4c02c170-7aa0-4684-8bd1-db13c31ca0d7','cc05b280-74c7-4e9a-ae92-3d5a50207b07','dfb36495-333d-40e8-a7ab-386921d86090','A','/objects/uploads/ae42eeca-c6a6-4bea-8f90-28d46b581ae0','FLOORING LAYOUT.pdf',910870,'application/pdf','approved',NULL,'2025-12-09 18:00:09','2025-12-09 18:00:09',NULL),
    ('bb60d1c1-0356-4f9b-8050-accf16e337db','cc05b280-74c7-4e9a-ae92-3d5a50207b07','e85d7ee9-4d21-48f8-8a76-10c22b0e16d3','A','/objects/uploads/c540b826-783c-4877-be5c-328f9b17dd8e','HVAC LAYOUT.pdf',1243308,'application/pdf','approved',NULL,'2025-12-09 17:59:35','2025-12-09 17:59:35',NULL),
    ('49c6890a-ead4-4ebb-ac90-01f048821675','cc05b280-74c7-4e9a-ae92-3d5a50207b07','4bf5a49e-700f-487c-9339-f90ae3718fd1','A','/objects/uploads/2e9c5909-8577-4182-965a-5f553635433b','31-01-2026 - LIGHTING LAYOUT - FOCUS LIGHTING - MAKER TOWERS 131 A.pdf',1894813,'application/pdf','approved',NULL,'2026-01-31 06:49:11','2026-01-31 06:49:11',NULL),
    ('26f0fae4-0071-4243-90e0-0180948b4d70','cc05b280-74c7-4e9a-ae92-3d5a50207b07','d9f8e31f-d91e-4251-963b-d26d55f668ee','A','/objects/uploads/97e2b156-6301-4df7-a1d9-64b26fe961ca','26-03-2026 - Light Measurement layout - Maker Towers - 131 A.pdf',1753271,'application/pdf','approved',NULL,'2026-03-27 09:16:08','2026-03-27 09:16:08',NULL),
    ('816f88a1-b1d7-4590-b824-72c6ef1205b0','cc05b280-74c7-4e9a-ae92-3d5a50207b07','1c587cd4-bf4c-48d4-824b-9359a3fba594','A','/objects/uploads/10ed4c56-5ea2-4b3f-bb29-699e51dabf89','MASTER BATHROOM LAYOUT - 18-11-25.pdf',325177,'application/pdf','approved',NULL,'2025-11-18 07:18:51','2025-11-18 07:18:51',NULL),
    ('c9e654af-498a-48c0-8222-0c7f5fa4cd77','cc05b280-74c7-4e9a-ae92-3d5a50207b07','985bef8b-3ba1-4503-9b20-343363f7ff48','A','/objects/uploads/60a68bd5-bc67-443d-902b-dc5517a178ab','MUSIC BATHROOM - 18-11-25.pdf',319527,'application/pdf','approved',NULL,'2025-11-18 07:21:35','2025-11-18 07:21:35',NULL),
    ('d232936a-9b8a-4b15-928e-40aabf37cec2','cc05b280-74c7-4e9a-ae92-3d5a50207b07','e787d8d4-f36e-4277-b7ed-4d2410160632','A','/objects/uploads/0350656f-70dc-413b-bff0-34f6a08b4e7b','MAKER TOWER_FLOOR PLAN @A2 Mar 08''25.pdf',703923,'application/pdf','approved',NULL,'2025-10-01 10:26:10','2025-10-01 10:26:10',NULL),
    ('09f8a3ae-abe9-4c0e-b856-9c718192210f','cc05b280-74c7-4e9a-ae92-3d5a50207b07','cd36d389-76ba-4f3d-a994-40fc14872d6b','A','/objects/uploads/a5fa6a3d-f866-438a-813d-27c617302bd8','Reflected ceiling layouts Nov 19''2025.pdf',1010367,'application/pdf','approved',NULL,'2025-11-20 05:45:01','2025-11-20 05:45:01',NULL),
    ('79e80906-1c19-4d8c-bb17-ec775a171608','cc05b280-74c7-4e9a-ae92-3d5a50207b07','3f2f3ccc-046b-44a6-8df8-70966113e9ac','A','/objects/uploads/68e8ce15-df0a-4e22-8adb-4ebb7b98125a','SWITCHBOARD LAYOUT.pdf',885966,'application/pdf','approved',NULL,'2025-12-09 17:59:06','2025-12-09 17:59:06',NULL),
    ('775d6eaa-da63-4396-a212-a784dd09d7c0','cc05b280-74c7-4e9a-ae92-3d5a50207b07','6ee66453-5703-4a95-b74c-b22af1748aba','A','/objects/uploads/4c8b932e-547c-45bc-8eaa-7b0b50a67c27','Walling plans R1 Sept 20''2025.pdf',782754,'application/pdf','approved',NULL,'2025-10-20 12:08:56','2025-10-20 12:08:56',NULL)
    ON CONFLICT DO NOTHING;

    -- ── REVISION EVENTS ────────────────────────────────────────────────────
    INSERT INTO revision_events (id, org_id, revision_id, event_type, actor_id, created_at)
    VALUES
      ('d656b129-a090-412f-8f63-7e936c81e447','cc05b280-74c7-4e9a-ae92-3d5a50207b07','d3eb17a5-a24c-47ff-ad83-cce164aedad8','uploaded',NULL,'2025-11-20 05:25:57'),
    ('d282b621-91d8-46f7-9a9a-3befec41e513','cc05b280-74c7-4e9a-ae92-3d5a50207b07','27598086-203f-4ae6-8211-b15fa9feecd9','uploaded',NULL,'2025-12-23 07:03:24'),
    ('a68e60e5-634b-432d-8bf8-a2a116b2ecb4','cc05b280-74c7-4e9a-ae92-3d5a50207b07','c57153f4-9a65-4e5b-bae9-1e7763fa70a6','uploaded',NULL,'2025-12-22 12:50:31'),
    ('7cae6727-a473-4c60-ab5f-a7e90074347b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','3b647116-1eff-49a1-8684-82d3da97d2ae','uploaded',NULL,'2025-12-22 12:49:32'),
    ('097072b9-8428-4ad6-900c-b08a2bae7d58','cc05b280-74c7-4e9a-ae92-3d5a50207b07','300f6f58-5566-4c9f-a929-905666118188','uploaded','48590680','2026-05-22 08:48:30'),
    ('9d15d385-6085-4dc1-92b8-0a66f491cd86','cc05b280-74c7-4e9a-ae92-3d5a50207b07','42dc9ad4-5d87-4fe9-b381-614ececf7004','uploaded','48688631','2026-05-27 04:58:04'),
    ('7ff5f5b6-6d92-49be-a90c-428900396b03','cc05b280-74c7-4e9a-ae92-3d5a50207b07','6567656f-db33-4be0-a9f4-967194372e9f','uploaded','48688631','2026-05-27 04:18:11'),
    ('55bfd558-ea4a-4a90-af83-4673f7284bc8','cc05b280-74c7-4e9a-ae92-3d5a50207b07','558ecfb9-72a9-4217-9536-ee623d711978','uploaded','48688631','2026-05-26 07:41:08'),
    ('34b1bd49-2a33-4d6a-9a14-215319c91310','cc05b280-74c7-4e9a-ae92-3d5a50207b07','13627eae-abfd-4e28-a086-fced991c2fd2','uploaded','48688631','2026-05-26 07:43:39'),
    ('d81b7e39-1dd6-4bbb-ad77-3bc07e244717','cc05b280-74c7-4e9a-ae92-3d5a50207b07','f18c2aa5-22c7-4efa-943a-04896c4bd969','uploaded','48590680','2026-04-23 07:29:01'),
    ('d10325f2-e5b3-4de2-82ce-768f822940da','cc05b280-74c7-4e9a-ae92-3d5a50207b07','fac4ae14-91a8-4cda-90c1-60cc0fedd146','uploaded','48688631','2026-05-25 09:22:19'),
    ('922a5e76-950f-40cd-a95e-21a9ee9c1202','cc05b280-74c7-4e9a-ae92-3d5a50207b07','afc23e61-ba45-43c2-aaab-1ae6a8a0f74d','uploaded','48688631','2026-05-27 04:12:11'),
    ('22f54cd2-4f43-4057-9774-5fb8a10e90d5','cc05b280-74c7-4e9a-ae92-3d5a50207b07','99f27ed4-1d95-4ded-bc68-7db871bba427','uploaded','48688631','2026-05-26 05:37:15'),
    ('61bdc032-b26f-42b4-9717-2c65ab23be7a','cc05b280-74c7-4e9a-ae92-3d5a50207b07','f05ffd11-83b1-4b54-b7f0-96a5cb3ed202','uploaded','48688631','2026-05-26 06:35:38'),
    ('83145cda-379a-4c9f-a8f4-e2cf55099625','cc05b280-74c7-4e9a-ae92-3d5a50207b07','732f3f7a-1130-492b-b05c-791ae4405e20','uploaded','48688631','2026-05-26 07:31:55'),
    ('4fcded72-f52e-4e79-a350-72a0c5985290','cc05b280-74c7-4e9a-ae92-3d5a50207b07','a00cb408-ccf5-4731-afa2-9edfebb6e325','uploaded','48688631','2026-05-26 06:36:16'),
    ('badeeae2-5eb2-41cc-965e-60596cf0a434','cc05b280-74c7-4e9a-ae92-3d5a50207b07','0dd1bfe9-5527-4b57-b044-2116bad37421','uploaded','48688631','2026-05-26 06:37:24'),
    ('28c5c7c2-ecf6-4f5b-991d-b1df8e30306f','cc05b280-74c7-4e9a-ae92-3d5a50207b07','e8410623-1f0a-4b3a-98ed-a48eca47f040','uploaded','48688631','2026-05-26 06:33:29'),
    ('202a3cdc-dcca-4d40-8dc8-e8d4f3a009e1','cc05b280-74c7-4e9a-ae92-3d5a50207b07','06282678-8e4f-4b3f-9c35-bcc385c1521f','uploaded','48688631','2026-03-05 06:51:36'),
    ('d172070a-36cb-4811-a6d5-b785d8f42391','cc05b280-74c7-4e9a-ae92-3d5a50207b07','ed6700e2-522d-47d1-8679-a32cbf7228ce','uploaded','48688631','2026-05-26 06:38:26'),
    ('4d347daa-51da-41a6-8bc5-85069375d107','cc05b280-74c7-4e9a-ae92-3d5a50207b07','cd330aad-0054-4c6e-a28f-fbdcbf5a8bc8','uploaded','48688631','2026-05-25 09:23:08'),
    ('59e8841d-5f0e-467e-8de5-2b3db021b924','cc05b280-74c7-4e9a-ae92-3d5a50207b07','1f2f1599-7f8e-4ba9-97ae-390a92c899e2','uploaded','48688631','2026-05-26 05:07:03'),
    ('2926c1f2-43b7-461e-a99c-1f7e7985e54d','cc05b280-74c7-4e9a-ae92-3d5a50207b07','70d4d5f1-c537-4669-9fe8-325da0823618','uploaded','48688631','2026-03-05 06:53:39'),
    ('61a2f298-5b6e-4d98-b515-8d9193c047ad','cc05b280-74c7-4e9a-ae92-3d5a50207b07','b77fc7fb-b27f-4ab3-8457-e4b4611b0210','uploaded','48590680','2026-05-02 13:05:49'),
    ('7907357e-a1ff-404c-8a80-67dfd3e46e8f','cc05b280-74c7-4e9a-ae92-3d5a50207b07','d7bb13f8-2341-4d62-b8b6-1265e3b1c502','uploaded','48688631','2026-03-05 08:02:52'),
    ('128198a2-a60d-48db-a813-5f9a04c4363a','cc05b280-74c7-4e9a-ae92-3d5a50207b07','e7dff807-bce7-48fd-92b9-d5e51b9a5ec5','uploaded','48688631','2026-05-26 07:53:02'),
    ('f4739238-a7b0-49d6-9e14-09ece2a5f8bd','cc05b280-74c7-4e9a-ae92-3d5a50207b07','c8168e76-fa6d-46b9-8c5f-44521f4eb01d','uploaded',NULL,'2025-12-24 05:23:03'),
    ('7bff8dd8-beb6-4f92-9659-5baed2743e28','cc05b280-74c7-4e9a-ae92-3d5a50207b07','e8479471-ed2c-43bd-86b4-bf1e54f5802d','uploaded','48688631','2026-05-06 15:35:16'),
    ('c9c96b7f-4ab7-48ac-859b-697535e86eeb','cc05b280-74c7-4e9a-ae92-3d5a50207b07','f72711b1-0cf4-42d2-8c38-ef361b1985bf','uploaded','48590680','2026-05-27 10:59:34'),
    ('f3065267-b166-486b-8b50-cb70eb0e107b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','d843e289-d9b6-40be-80e3-8b34c84a6902','uploaded','48688631','2026-05-26 04:49:19'),
    ('d4fdca04-bf9c-4ec6-b3c4-e697d019c4cf','cc05b280-74c7-4e9a-ae92-3d5a50207b07','ac679b2e-f79a-48ed-8134-e1c21b4566a8','uploaded','48688631','2026-05-26 04:55:58'),
    ('13f54e26-9809-4e3c-b2b1-05494ad85332','cc05b280-74c7-4e9a-ae92-3d5a50207b07','be378b3e-2570-4d74-95be-d08b4034fef4','uploaded','48688631','2026-05-26 04:51:36'),
    ('cc16b588-bf5c-4e89-91fd-288d7f52971a','cc05b280-74c7-4e9a-ae92-3d5a50207b07','d71b136c-0d14-4c28-bef4-573687f1afc7','uploaded','48688631','2026-05-26 04:52:56'),
    ('6df4bda1-6931-4015-9f29-b5baa51ea2fc','cc05b280-74c7-4e9a-ae92-3d5a50207b07','ec0afe74-906b-4a2d-93d1-862c0147a475','uploaded',NULL,'2026-01-27 11:07:54'),
    ('501d0736-f143-4897-b14a-b3adb495a176','cc05b280-74c7-4e9a-ae92-3d5a50207b07','4c02c170-7aa0-4684-8bd1-db13c31ca0d7','uploaded',NULL,'2025-12-09 18:00:09'),
    ('ccb68270-78af-4faa-8558-9182a856ca56','cc05b280-74c7-4e9a-ae92-3d5a50207b07','bb60d1c1-0356-4f9b-8050-accf16e337db','uploaded',NULL,'2025-12-09 17:59:35'),
    ('378262da-d637-4519-8fb4-3af3a903b114','cc05b280-74c7-4e9a-ae92-3d5a50207b07','49c6890a-ead4-4ebb-ac90-01f048821675','uploaded',NULL,'2026-01-31 06:49:11'),
    ('c2bcadf6-3f57-4ed8-a8c3-a4530e2b1912','cc05b280-74c7-4e9a-ae92-3d5a50207b07','26f0fae4-0071-4243-90e0-0180948b4d70','uploaded',NULL,'2026-03-27 09:16:08'),
    ('f29b5085-226f-4663-a405-94bcd360ced4','cc05b280-74c7-4e9a-ae92-3d5a50207b07','816f88a1-b1d7-4590-b824-72c6ef1205b0','uploaded',NULL,'2025-11-18 07:18:51'),
    ('b23e72a6-78ee-4d0a-9c56-eec75b1f4140','cc05b280-74c7-4e9a-ae92-3d5a50207b07','c9e654af-498a-48c0-8222-0c7f5fa4cd77','uploaded',NULL,'2025-11-18 07:21:35'),
    ('5f1f567e-fb5b-45af-9bd6-495a0e49f36a','cc05b280-74c7-4e9a-ae92-3d5a50207b07','d232936a-9b8a-4b15-928e-40aabf37cec2','uploaded',NULL,'2025-10-01 10:26:10'),
    ('df4b000f-36de-46e5-b4fa-0634c7308ecb','cc05b280-74c7-4e9a-ae92-3d5a50207b07','09f8a3ae-abe9-4c0e-b856-9c718192210f','uploaded',NULL,'2025-11-20 05:45:01'),
    ('0c6476b2-4aeb-4d41-ab00-bff2c6c3d97b','cc05b280-74c7-4e9a-ae92-3d5a50207b07','79e80906-1c19-4d8c-bb17-ec775a171608','uploaded',NULL,'2025-12-09 17:59:06'),
    ('cd9f050a-aae7-4d75-9936-1c271b292fd9','cc05b280-74c7-4e9a-ae92-3d5a50207b07','775d6eaa-da63-4396-a212-a784dd09d7c0','uploaded',NULL,'2025-10-20 12:08:56')
    ON CONFLICT DO NOTHING;

  END $$;
  