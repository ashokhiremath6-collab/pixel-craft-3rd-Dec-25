import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { 
  insertVendorCategorySchema,
  insertVendorSchema,
  insertProjectSchema,
  insertProjectVendorSchema,
  insertQuoteTemplateSchema,
  insertBoqSchema,
  insertQuoteFileSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Vendor Categories Routes
  app.get("/api/vendor-categories", async (req, res) => {
    try {
      const categories = await storage.getAllVendorCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendor categories" });
    }
  });

  // Hierarchical category endpoints - MUST come before /:id to avoid conflicts
  app.get("/api/vendor-categories/tree", async (req, res) => {
    try {
      const tree = await storage.getCategoryTree();
      res.json(tree);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category tree" });
    }
  });

  app.get("/api/vendor-categories/:id/children", async (req, res) => {
    try {
      const children = await storage.getChildCategories(req.params.id);
      res.json(children);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch child categories" });
    }
  });

  app.get("/api/vendor-categories/:id/descendants", async (req, res) => {
    try {
      const descendants = await storage.getCategoryWithDescendants(req.params.id);
      res.json(descendants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category descendants" });
    }
  });

  app.get("/api/vendor-categories/:id", async (req, res) => {
    try {
      const category = await storage.getVendorCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Vendor category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendor category" });
    }
  });

  app.post("/api/vendor-categories", async (req, res) => {
    try {
      const parsed = insertVendorCategorySchema.parse(req.body);
      const category = await storage.createVendorCategory(parsed);
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor category data" });
    }
  });

  app.put("/api/vendor-categories/:id", async (req, res) => {
    try {
      const parsed = insertVendorCategorySchema.partial().parse(req.body);
      const category = await storage.updateVendorCategory(req.params.id, parsed);
      if (!category) {
        return res.status(404).json({ error: "Vendor category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor category data" });
    }
  });

  app.delete("/api/vendor-categories/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVendorCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Vendor category not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to delete vendor category" 
      });
    }
  });

  // Vendors Routes
  app.get("/api/vendors", async (req, res) => {
    try {
      const vendors = await storage.getAllVendors();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors/category/:categoryId", async (req, res) => {
    try {
      const vendors = await storage.getVendorsByCategory(req.params.categoryId);
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors by category" });
    }
  });

  app.get("/api/vendors/by-parent-category/:parentId", async (req, res) => {
    try {
      const vendors = await storage.getVendorsByCategoryWithDescendants(req.params.parentId);
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors by parent category" });
    }
  });

  app.get("/api/vendors/:id", async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendor" });
    }
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const parsed = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(parsed);
      res.status(201).json(vendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });

  app.put("/api/vendors/:id", async (req, res) => {
    try {
      const parsed = insertVendorSchema.partial().parse(req.body);
      const vendor = await storage.updateVendor(req.params.id, parsed);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });

  app.delete("/api/vendors/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVendor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });

  // Projects Routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const parsed = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(parsed);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  // Quote Templates Routes
  app.get("/api/quote-templates", async (req, res) => {
    try {
      const templates = await storage.getAllQuoteTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote templates" });
    }
  });

  app.get("/api/quote-templates/category/:categoryId", async (req, res) => {
    try {
      const templates = await storage.getQuoteTemplatesByCategory(req.params.categoryId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates by category" });
    }
  });

  app.post("/api/quote-templates", async (req, res) => {
    try {
      const parsed = insertQuoteTemplateSchema.parse(req.body);
      const template = await storage.createQuoteTemplate(parsed);
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ error: "Invalid template data" });
    }
  });

  // Configure multer for file uploads
  const upload = multer({
    dest: '/tmp/uploads',
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/pdf', // .pdf for reference files
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only Excel (.xlsx, .xls), CSV, and PDF files are allowed.'));
      }
    }
  });

  // Helper function to parse Excel/CSV files
  const parseQuoteFile = async (filePath: string, mimeType: string) => {
    try {
      if (mimeType.includes('csv')) {
        // Parse CSV file
        const csvData = fs.readFileSync(filePath, 'utf8');
        const parsed = Papa.parse(csvData, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim().toLowerCase()
        });
        return parsed.data;
      } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        // Parse Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, {
          header: 1, // Get as array of arrays first
          defval: ''
        });
        
        if (data.length === 0) return [];
        
        // Convert to objects using first row as headers
        const headers = (data[0] as string[]).map(h => String(h).trim().toLowerCase());
        const rows = data.slice(1) as any[][];
        
        return rows.map(row => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        }).filter(row => Object.values(row).some(val => val !== ''));
      }
      
      return [];
    } catch (error) {
      console.error('Error parsing file:', error);
      throw new Error('Failed to parse file');
    }
  };

  // Helper function to process quote data and create records
  const processQuoteImport = async (data: any[], projectId: string, vendorId: string) => {
    const results = {
      projectVendor: null as any,
      boqItems: [] as any[],
      errors: [] as string[]
    };

    try {
      // Calculate total quotation value from BOQ items
      let totalValue = 0;
      const boqItems = [];

      for (const row of data) {
        // Try to map common column names (flexible mapping)
        const item = {
          description: row['description'] || row['item description'] || row['item'] || row['desc'] || '',
          quantity: parseFloat(row['quantity'] || row['qty'] || '0') || 0,
          unit: row['unit'] || row['uom'] || 'unit',
          unitRate: parseFloat(row['unit rate'] || row['rate'] || row['unit price'] || '0') || 0,
          category: row['category'] || row['type'] || 'General',
          itemCode: row['item code'] || row['code'] || '',
          specifications: row['specifications'] || row['spec'] || row['remarks'] || ''
        };

        if (item.description && item.quantity > 0 && item.unitRate > 0) {
          const totalAmount = item.quantity * item.unitRate;
          totalValue += totalAmount;
          
          boqItems.push({
            itemDescription: item.description,
            quantity: item.quantity.toString(),
            unit: item.unit,
            unitRate: item.unitRate.toString(),
            totalAmount: totalAmount.toString(),
            category: item.category,
            itemCode: item.itemCode || null,
            specifications: item.specifications || null
          });
        }
      }

      // Create project vendor record
      const projectVendorData = {
        projectId,
        vendorId,
        quotationValue: totalValue.toString(),
        dateOfQuotation: new Date().toISOString().split('T')[0],
        status: 'Quoted' as const,
        notes: `Imported ${boqItems.length} BOQ items`
      };

      const projectVendor = await storage.createProjectVendor(projectVendorData);
      results.projectVendor = projectVendor;

      // Create BOQ items
      if (boqItems.length > 0) {
        const boqDataWithProjectVendor = boqItems.map(item => ({
          ...item,
          projectVendorId: projectVendor.id
        }));
        
        results.boqItems = await storage.createBOQBatch(boqDataWithProjectVendor);
      }

    } catch (error) {
      results.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return results;
  };

  // Quote Import Routes
  app.post("/api/quotes/import", upload.single('quoteFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { projectId, vendorId } = req.body;
      
      if (!projectId || !vendorId) {
        return res.status(400).json({ error: "Project ID and Vendor ID are required" });
      }

      // Verify project and vendor exist
      const project = await storage.getProject(projectId);
      const vendor = await storage.getVendor(vendorId);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      // Parse the uploaded file
      const data = await parseQuoteFile(req.file.path, req.file.mimetype);
      
      if (!data || data.length === 0) {
        return res.status(400).json({ error: "No valid data found in file" });
      }

      // Process the quote import
      const results = await processQuoteImport(data, projectId, vendorId);
      
      // Store file information
      const filePath = `/uploads/${req.file.filename}`;
      const quoteFileData = {
        projectVendorId: results.projectVendor.id,
        fileName: req.file.originalname,
        filePath: filePath,
        fileType: path.extname(req.file.originalname).toLowerCase(),
        fileSize: req.file.size.toString()
      };
      
      await storage.createQuoteFile(quoteFileData);

      // Update project vendor with file path
      await storage.updateProjectVendor(results.projectVendor.id, {
        quotationFile: filePath
      });

      // Clean up temporary file
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.warn('Failed to clean up temporary file:', error);
      }

      res.status(201).json({
        message: "Quote imported successfully",
        projectVendor: results.projectVendor,
        boqItems: results.boqItems,
        totalItems: results.boqItems.length,
        totalValue: results.projectVendor.quotationValue,
        errors: results.errors
      });

    } catch (error) {
      console.error('Quote import error:', error);
      
      // Clean up temporary file if it exists
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.warn('Failed to clean up temporary file:', e);
        }
      }
      
      res.status(500).json({ 
        error: "Failed to import quote",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get BOQ items for a project vendor
  app.get("/api/project-vendors/:id/boq", async (req, res) => {
    try {
      const boqItems = await storage.getBOQByProjectVendor(req.params.id);
      res.json(boqItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch BOQ items" });
    }
  });

  // Get quote files for a project vendor
  app.get("/api/project-vendors/:id/files", async (req, res) => {
    try {
      const files = await storage.getQuoteFilesByProjectVendor(req.params.id);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote files" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
