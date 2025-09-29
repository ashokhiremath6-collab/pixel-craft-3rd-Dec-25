-- Vendor Categories for Production Database
-- Run these INSERT statements in your production database

INSERT INTO vendor_categories (id, name, parent_id, description, is_active) VALUES
('e90004d0-dd2a-464c-ade9-9d7b7484249e', 'Appliances', NULL, 'Home and commercial appliances', true),
('aa9a64bf-6d79-4a38-aa7f-5fd4db2dab55', 'Audio Systems', NULL, 'Audio equipment and sound systems', true),
('91dc2614-1c19-457e-9c1e-ee5745a5c483', 'Automation', NULL, 'Home and building automation systems', true),
('b5e9f043-6d6f-44fa-adc7-77f53095d71a', 'Bathroom Fittings', NULL, 'Bathroom fixtures and accessories', true),
('dbf9b44e-e101-4a5f-a644-f608a93e72b6', 'Carpentry', NULL, 'Woodwork and carpentry services', true),
('c6d360a6-71fb-4df9-9539-dbaf2fdd4e52', 'Civil', NULL, 'Civil construction and infrastructure work', true),
('b102b22f-a3e0-4065-84f5-06aa176cebc0', 'Doors and windows', NULL, 'Door and window suppliers', true),
('737a2b4e-9fca-47b3-abed-85752ec6899b', 'Electricals', NULL, 'Electrical systems and components', true),
('57082761-0bbd-48c9-998d-603fd4f0c174', 'Flooring', NULL, 'Floor materials and installation', true),
('e24ac752-a67a-4794-844b-68d870ded563', 'Furniture', NULL, 'Furniture and furnishing items', true),
('dd937ddb-2299-47c9-95ba-3a20f6beff7d', 'HVAC', NULL, 'Heating, ventilation, and air conditioning', true),
('1344bee8-9bd9-4a5a-8de2-9b67a1141a44', 'Kitchen', NULL, 'Kitchen equipment and fixtures', true),
('ca250e6e-3840-4958-9772-c7fd64d69862', 'Lighting', NULL, 'Lighting fixtures and systems', true),
('12ba7fa4-1d90-4bea-b1be-1155bc192a6d', 'Other', NULL, 'Other miscellaneous vendors', true),
('07e82b25-ca8a-415b-ba2b-3a2d72fed640', 'Plumbing', NULL, 'Plumbing systems and fixtures', true),
('5daa719e-0302-4337-957d-005a06ceb3dd', 'Soft Furnishings', NULL, 'Curtains, carpets, and textile furnishings', true),
('e4be256d-1456-4426-94f0-dc8eef018955', 'Wall Finishes', NULL, 'Paint, wallpaper, and wall treatments', true);

-- Optional: To handle conflicts if some categories already exist, use this instead:
-- INSERT INTO vendor_categories (id, name, parent_id, description, is_active) VALUES
-- (...same values as above...)
-- ON CONFLICT (id) DO NOTHING;