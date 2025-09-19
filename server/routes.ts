import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertVendorCategorySchema,
  insertVendorSchema,
  insertProjectSchema,
  insertProjectVendorSchema,
  insertQuoteTemplateSchema 
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

  // Hierarchical category endpoints
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

  const httpServer = createServer(app);

  return httpServer;
}
