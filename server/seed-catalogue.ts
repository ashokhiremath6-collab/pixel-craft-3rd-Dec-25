import { db } from "./db";
import { catalogueItems } from "@shared/schema";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

interface CatalogueRow {
  Category: string;
  Subcategory: string;
  Example_Attributes: string;
}

async function seedCatalogueItems() {
  try {
    console.log("Starting catalogue seed...");
    
    // Read CSV file
    const csvPath = path.join(process.cwd(), "attached_assets", "interior_catalog_taxonomy_1761034466006.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    
    // Parse CSV
    const parsed = Papa.parse<CatalogueRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (parsed.errors.length > 0) {
      console.error("CSV parsing errors:", parsed.errors);
      return;
    }
    
    console.log(`Found ${parsed.data.length} catalogue items in CSV`);
    
    // Insert items into database
    const items = parsed.data.map(row => ({
      mainCategory: row.Category,
      subcategory: row.Subcategory,
      attributes: row.Example_Attributes,
    }));
    
    // Insert in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await db.insert(catalogueItems).values(batch);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`);
    }
    
    console.log(`✅ Successfully seeded ${items.length} catalogue items`);
    
    // Verify the data
    const count = await db.select().from(catalogueItems);
    console.log(`Total catalogue items in database: ${count.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding catalogue:", error);
    process.exit(1);
  }
}

seedCatalogueItems();
