-- Batch 1: First 25 items
-- Run this in Production Database -> SQL Console

DELETE FROM catalogue_items;

INSERT INTO catalogue_items (id, main_category, subcategory, vendor_brand, description, attributes, file_name, file_path, created_at) VALUES
('77336b8a-8132-4d37-8afd-065b6ed1bf4a', 'Acoustics', 'Panels & Baffles', NULL, NULL, 'NRC, material, mounting', NULL, NULL, '2025-10-21 08:31:18.139558'),
('2b56184b-12db-43b9-9e35-c4fc8beb96ee', 'Acoustics', 'Underlays & Doors', NULL, NULL, 'Rw/STC ratings, thickness', NULL, NULL, '2025-10-21 08:31:18.139558'),
('e6c82a02-aa15-44c1-83af-83e907a7890a', 'Appliances', 'Cooking (Ovens/Hobs/Hoods)', NULL, NULL, 'Fuel/electric, zones/burners, width, extraction', NULL, NULL, '2025-10-21 08:31:18.107715'),
('bfa397a5-8475-4745-b3e9-4a6e93eaa623', 'Appliances', 'Dishwashers', NULL, NULL, 'Place settings, noise, panel-ready', NULL, NULL, '2025-10-21 08:31:18.107715'),
('a3265f1a-e992-43d2-bc29-16e9c7e11beb', 'Appliances', 'Laundry (Washer/Dryer)', NULL, NULL, 'Capacity, heat-pump, stackable', NULL, NULL, '2025-10-21 08:31:18.107715'),
('7bcf1fb6-a07d-40cc-bee7-adb86223fac5', 'Appliances', 'Microwaves & Steam Ovens', NULL, NULL, 'Built-in/freestanding, capacity, features', NULL, NULL, '2025-10-21 08:31:18.107715'),
('3fa35d62-c8b2-4991-ac66-1b9a36b43df1', 'Appliances', 'Refrigeration', NULL, NULL, 'Type, capacity, finish, energy rating', NULL, NULL, '2025-10-21 08:31:18.107715'),
('d241ddc7-378d-49d0-a1b3-9e72a9ec6578', 'Appliances', 'Small Appliances (Kitchen)', NULL, NULL, 'Toaster, mixer, coffee, blender', NULL, NULL, '2025-10-21 08:31:18.107715'),
('57c5bb5b-8893-4a4b-901d-04e85a8a9ed7', 'Art', 'Artist', NULL, NULL, 'Style, medium, size, framing, subject matter', NULL, NULL, '2025-10-21 09:02:36.597146'),
('b45d6994-912c-40a9-b135-7a1ef29baa64', 'Bathroom Fittings', 'Accessories', NULL, NULL, 'Towel rails, holders, shelves, mirrors', NULL, NULL, '2025-10-21 08:31:18.107715'),
('afe66b35-5fff-438e-84be-385020302634', 'Bathroom Fittings', 'Bathtubs & Spas', NULL, NULL, 'Freestanding, inset, size, material', NULL, NULL, '2025-10-21 08:31:18.107715'),
('31e67303-5f13-47e7-997b-c02e70ca8727', 'Bathroom Fittings', 'Faucets & Mixers', NULL, NULL, 'Basin, bath, shower mixers; finish; flow', NULL, NULL, '2025-10-21 08:31:18.107715'),
('e22a6997-588e-4fe9-8ff6-3ae80c30a997', 'Bathroom Fittings', 'Sanitaryware', NULL, NULL, 'WCs (wall/floor), basins, bidets', NULL, NULL, '2025-10-21 08:31:18.107715'),
('b99509e0-edd6-4349-95e2-789ad7c62139', 'Bathroom Fittings', 'Shower Enclosures', NULL, NULL, 'Framed/semi/frameless, glass thickness, finish', NULL, NULL, '2025-10-21 08:31:18.107715'),
('331a9c39-2694-403c-a88d-c6c4341dff93', 'Bathroom Fittings', 'Showers & Systems', NULL, NULL, 'Handshower, rain, thermostatic, body jets', NULL, NULL, '2025-10-21 08:31:18.107715'),
('61a82b80-279d-4984-a622-cfa824a1769a', 'Bathroom Fittings', 'Vanities & Storage', NULL, NULL, 'Widths, tops, basins, soft-close', NULL, NULL, '2025-10-21 08:31:18.107715'),
('d3bfaf59-b3c4-49b9-8177-d5d6b5fcfdbc', 'Bathroom Fittings', 'Water Heaters', NULL, NULL, 'Instant/storage, capacity, energy rating', NULL, NULL, '2025-10-21 08:31:18.107715'),
('fda59e02-4523-4242-8d43-757be9c6b3c3', 'Doors & Windows', 'External Doors', NULL, NULL, 'Weather rating, security hardware', NULL, NULL, '2025-10-21 08:31:18.139558'),
('3926225e-5a5e-4d76-835d-d9cbcafb2498', 'Doors & Windows', 'Hardware', NULL, NULL, 'Hinges, locks, handles, closers', NULL, NULL, '2025-10-21 08:31:18.139558'),
('af0d74ea-6439-4401-b640-544603a83ee4', 'Doors & Windows', 'Internal Doors', NULL, NULL, 'Solid/engineered, fire rating, finish', NULL, NULL, '2025-10-21 08:31:18.139558'),
('ccd50133-786c-47f3-a467-25601a7fa276', 'Doors & Windows', 'Skylights & Roof Windows', NULL, NULL, 'Fixed/vented, flashing kits', NULL, NULL, '2025-10-21 08:31:18.139558'),
('e724a68f-c19b-4fce-a2fd-7181cf1defea', 'Doors & Windows', 'Windows & Glazing', NULL, NULL, 'uPVC/aluminium, glazing type, U-value', NULL, NULL, '2025-10-21 08:31:18.139558'),
('d243d07a-d4ab-4129-8f93-e312f8a9f023', 'Décor', 'Artwork & Prints', NULL, NULL, 'Framing, size, mounting', NULL, NULL, '2025-10-21 08:31:18.139558'),
('1312f2b2-b98d-4af6-8309-70bdc4865f94', 'Décor', 'Mirrors', NULL, NULL, 'Framed/frameless, bevel, LED', NULL, NULL, '2025-10-21 08:31:18.139558'),
('8b4e95ce-bec9-4f28-bdc7-75150691c673', 'Décor', 'Vases & Accessories', NULL, NULL, 'Material, size, finish', NULL, NULL, '2025-10-21 08:31:18.139558');

SELECT COUNT(*) as inserted_so_far FROM catalogue_items;
