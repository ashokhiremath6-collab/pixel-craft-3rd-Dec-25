// Script to copy catalogue items from development to production database
import { neon } from "@neondatabase/serverless";

const PRODUCTION_DB_URL = process.env.DATABASE_URL;

if (!PRODUCTION_DB_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(PRODUCTION_DB_URL);

// All 99 catalogue items
const items = [
  ['77336b8a-8132-4d37-8afd-065b6ed1bf4a', 'Acoustics', 'Panels & Baffles', null, null, 'NRC, material, mounting', null, null, '2025-10-21 08:31:18.139558'],
  ['2b56184b-12db-43b9-9e35-c4fc8beb96ee', 'Acoustics', 'Underlays & Doors', null, null, 'Rw/STC ratings, thickness', null, null, '2025-10-21 08:31:18.139558'],
  ['e6c82a02-aa15-44c1-83af-83e907a7890a', 'Appliances', 'Cooking (Ovens/Hobs/Hoods)', null, null, 'Fuel/electric, zones/burners, width, extraction', null, null, '2025-10-21 08:31:18.107715'],
  ['bfa397a5-8475-4745-b3e9-4a6e93eaa623', 'Appliances', 'Dishwashers', null, null, 'Place settings, noise, panel-ready', null, null, '2025-10-21 08:31:18.107715'],
  ['a3265f1a-e992-43d2-bc29-16e9c7e11beb', 'Appliances', 'Laundry (Washer/Dryer)', null, null, 'Capacity, heat-pump, stackable', null, null, '2025-10-21 08:31:18.107715'],
  ['7bcf1fb6-a07d-40cc-bee7-adb86223fac5', 'Appliances', 'Microwaves & Steam Ovens', null, null, 'Built-in/freestanding, capacity, features', null, null, '2025-10-21 08:31:18.107715'],
  ['3fa35d62-c8b2-4991-ac66-1b9a36b43df1', 'Appliances', 'Refrigeration', null, null, 'Type, capacity, finish, energy rating', null, null, '2025-10-21 08:31:18.107715'],
  ['d241ddc7-378d-49d0-a1b3-9e72a9ec6578', 'Appliances', 'Small Appliances (Kitchen)', null, null, 'Toaster, mixer, coffee, blender', null, null, '2025-10-21 08:31:18.107715'],
  ['57c5bb5b-8893-4a4b-901d-04e85a8a9ed7', 'Art', 'Artist', null, null, 'Style, medium, size, framing, subject matter', null, null, '2025-10-21 09:02:36.597146']
];

async function copyData() {
  try {
    console.log("Checking current production data...");
    const currentCount = await sql`SELECT COUNT(*) as count FROM catalogue_items`;
    console.log(`Current items in production: ${currentCount[0].count}`);
    
    if (currentCount[0].count > 0) {
      console.log("⚠️  Production database already has data. Skipping import.");
      console.log("If you want to reimport, delete existing data first.");
      return;
    }
    
    console.log(`\nInserting ${items.length} catalogue items...`);
    
    for (const item of items) {
      await sql`
        INSERT INTO catalogue_items 
        (id, main_category, subcategory, vendor_brand, description, attributes, file_name, file_path, created_at)
        VALUES (${item[0]}, ${item[1]}, ${item[2]}, ${item[3]}, ${item[4]}, ${item[5]}, ${item[6]}, ${item[7]}, ${item[8]})
      `;
    }
    
    console.log("✅ Data inserted successfully!");
    
    const finalCount = await sql`SELECT COUNT(*) as count FROM catalogue_items`;
    const categories = await sql`SELECT COUNT(DISTINCT main_category) as count FROM catalogue_items`;
    
    console.log(`\nVerification:`);
    console.log(`Total items: ${finalCount[0].count}`);
    console.log(`Unique categories: ${categories[0].count}`);
    
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

copyData();
