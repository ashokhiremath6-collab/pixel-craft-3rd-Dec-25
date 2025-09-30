import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import multer from "multer";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import pdfParse from "pdf-parse";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { 
  insertVendorCategorySchema,
  insertVendorSchema,
  insertProjectSchema,
  insertProjectVendorSchema,
  insertQuoteTemplateSchema,
  insertBoqSchema,
  insertQuoteFileSchema,
  insertFloorPlanSchema,
  insertMoodboardSchema,
  insertUserRoleSchema
} from "@shared/schema";
import { z } from "zod";

// Replit Auth provides /api/login and /api/logout automatically

// Session configuration types
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: string;
    oauthState?: string;
    oauthNonce?: string;
  }
}

// Authentication middleware for Replit Auth
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  try {
    const userId = (req.user as any).claims.sub;
    const userRole = await storage.getUserRole(userId);
    if (!userRole || (userRole.role !== 'designer' && userRole.role !== 'admin')) {
      return res.status(403).json({ error: "Admin or designer access required" });
    }
    next();
  } catch (error) {
    console.error('Error checking user role:', error);
    return res.status(500).json({ error: "Failed to check authorization" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup real Replit Auth (handles session configuration internally)
  await setupAuth(app);

  // Object Storage endpoints for permanent file storage
  // Endpoint to get presigned upload URL
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Endpoint to serve private objects from object storage
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(403);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Helper function to upload file buffer to object storage and return the object path
  async function uploadToObjectStorage(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    mimeType: string
  ): Promise<string> {
    const objectStorageService = new ObjectStorageService();
    
    // Get presigned upload URL
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    
    // Upload file to object storage
    const uploadResponse = await fetch(uploadURL, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': mimeType,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file to object storage: ${uploadResponse.statusText}`);
    }
    
    // Extract the object path from the signed URL
    // The URL format is: https://storage.googleapis.com/bucket-name/path/to/object?signature=...
    const url = new URL(uploadURL);
    const pathname = url.pathname; // e.g., /bucket-name/path/to/object
    
    // Extract the entity ID from the pathname
    // Assuming the private object dir format is /bucket-name/.private
    // and uploads go to /bucket-name/.private/uploads/uuid
    const pathParts = pathname.split('/uploads/');
    if (pathParts.length < 2) {
      throw new Error('Invalid upload URL format');
    }
    const entityId = 'uploads/' + pathParts[pathParts.length - 1];
    const objectPath = `/objects/${entityId}`;
    
    // Set ACL policy for the uploaded file
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.trySetObjectEntityAclPolicy(
        objectPath,
        {
          owner: userId,
          visibility: "private",
        }
      );
    } catch (error) {
      console.error('Error setting ACL policy:', error);
      // Continue even if ACL fails - file is uploaded
    }
    
    return objectPath;
  }

  // Secure file download endpoints (replace static serving with authenticated handlers)
  // Files are now served through authenticated endpoints below instead of static routes
  
  // Authenticated file download for uploads (quotations, BOQ files, etc.)
  app.get('/uploads/:filename', requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Prevent path traversal attacks - validate filename
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, filename);
      
      // Double-check path safety - ensure resolved path is within uploads directory
      const resolvedPath = path.resolve(filePath);
      const resolvedUploadsDir = path.resolve(uploadsDir);
      if (!resolvedPath.startsWith(resolvedUploadsDir)) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Project-level authorization: Find which project this file belongs to
      try {
        // Check if this file is associated with any project vendor (quotation files)
        const allProjectVendors = await storage.getAllProjectVendors();
        const associatedProjectVendor = allProjectVendors.find(pv => 
          pv.quotationFile && pv.quotationFile.includes(filename)
        );
        
        if (associatedProjectVendor) {
          // Check if user has access to this project
          const userId = (req.user as any).claims.sub;
          const userRole = await storage.getUserRole(userId);
          
          if (!userRole) {
            return res.status(403).json({ error: 'User role not found' });
          }
          
          if (userRole.role === 'designer' || userRole.role === 'admin') {
            // Designer or admin can access all files
          } else if (userRole.role === 'client') {
            // Check if client has access to this project (role-based access)
            const accessibleProjects = await storage.getProjectsForUser(userId, userRole.role);
            const hasAccess = accessibleProjects.some(project => project.id === associatedProjectVendor.projectId);
            
            if (!hasAccess) {
              return res.status(403).json({ error: 'Access denied - insufficient project permissions' });
            }
          } else {
            return res.status(403).json({ error: 'Access denied - invalid role' });
          }
        } else {
          // File not associated with any project - only designer or admin can access
          const userId = (req.user as any).claims.sub;
          const userRole = await storage.getUserRole(userId);
          if (!userRole || (userRole.role !== 'designer' && userRole.role !== 'admin')) {
            return res.status(403).json({ error: 'Access denied - file not associated with accessible project' });
          }
        }
      } catch (authError) {
        console.error('Error checking file authorization:', authError);
        return res.status(500).json({ error: 'Authorization check failed' });
      }
      
      // Serve the file with proper headers
      const stat = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);
      
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).json({ error: 'Failed to serve file' });
    }
  });
  
  // Authenticated file download for floor plans
  app.get('/uploads/floor-plans/:filename', requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Prevent path traversal attacks - validate filename
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      const floorPlansDir = path.join(process.cwd(), 'uploads', 'floor-plans');
      const filePath = path.join(floorPlansDir, filename);
      
      // Double-check path safety - ensure resolved path is within floor-plans directory
      const resolvedPath = path.resolve(filePath);
      const resolvedFloorPlansDir = path.resolve(floorPlansDir);
      if (!resolvedPath.startsWith(resolvedFloorPlansDir)) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Floor plan file not found' });
      }
      
      // Project-level authorization: Find which project this floor plan belongs to
      try {
        // Check if this file is associated with any floor plan
        const allFloorPlans = await storage.getAllFloorPlans();
        const associatedFloorPlan = allFloorPlans.find(fp => 
          fp.filePath && fp.filePath.includes(filename)
        );
        
        if (associatedFloorPlan) {
          // Check if user has access to this project
          const userId = (req.user as any).claims.sub;
          const userRole = await storage.getUserRole(userId);
          
          if (!userRole) {
            return res.status(403).json({ error: 'User role not found' });
          }
          
          if (userRole.role === 'designer' || userRole.role === 'admin') {
            // Designer or admin can access all files
          } else if (userRole.role === 'client') {
            // Check if client has access to this project
            const accessibleProjects = await storage.getProjectsForUser(userId, userRole.role);
            const hasAccess = accessibleProjects.some(project => project.id === associatedFloorPlan.projectId);
            
            if (!hasAccess) {
              return res.status(403).json({ error: 'Access denied - insufficient project permissions' });
            }
          } else {
            return res.status(403).json({ error: 'Access denied - invalid role' });
          }
        } else {
          // File not associated with any project - only designer or admin can access
          const userId = (req.user as any).claims.sub;
          const userRole = await storage.getUserRole(userId);
          if (!userRole || (userRole.role !== 'designer' && userRole.role !== 'admin')) {
            return res.status(403).json({ error: 'Access denied - floor plan not associated with accessible project' });
          }
        }
      } catch (authError) {
        console.error('Error checking floor plan authorization:', authError);
        return res.status(500).json({ error: 'Authorization check failed' });
      }
      
      // Serve the file with proper headers
      const stat = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);
      
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error serving floor plan file:', error);
      res.status(500).json({ error: 'Failed to serve floor plan file' });
    }
  });
  
  // Authenticated file download for moodboards
  app.get('/uploads/moodboards/:filename', requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Prevent path traversal attacks - validate filename
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      const moodboardsDir = path.join(process.cwd(), 'uploads', 'moodboards');
      const filePath = path.join(moodboardsDir, filename);
      
      // Double-check path safety - ensure resolved path is within moodboards directory
      const resolvedPath = path.resolve(filePath);
      const resolvedMoodboardsDir = path.resolve(moodboardsDir);
      if (!resolvedPath.startsWith(resolvedMoodboardsDir)) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Moodboard file not found' });
      }
      
      // Moodboards are currently global (not project-specific), so basic auth check is sufficient
      // In future, you could add project-level authorization similar to floor plans
      
      // Serve the file with proper headers for inline viewing
      const stat = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);
      
      // Set proper MIME type based on file extension
      const ext = path.extname(filename).toLowerCase();
      let mimeType = 'application/octet-stream';
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.svg':
          mimeType = 'image/svg+xml';
          break;
        case '.webp':
          mimeType = 'image/webp';
          break;
        case '.pdf':
          mimeType = 'application/pdf';
          break;
      }
      
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`); // inline for previews
      
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error serving moodboard file:', error);
      res.status(500).json({ error: 'Failed to serve moodboard file' });
    }
  });
  
  // Authentication Routes
  
  // Check authentication status
  // Real auth endpoint to get current user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const userRole = await storage.getUserRole(user.id);
      
      res.json({
        ...user,
        role: userRole?.role || "client"
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  
  // Replit Auth handles login automatically at /api/login
  
  // Replit Auth handles logout automatically at /api/logout

  // Role management endpoint for admins
  app.post("/api/auth/role", requireAdmin, async (req, res) => {
    try {
      const { userId, role } = req.body;
      
      if (!userId || !role) {
        return res.status(400).json({ error: "User ID and role are required" });
      }
      
      if (!['client', 'designer', 'admin'].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update user role
      const updatedRole = await storage.updateUserRole(userId, role);
      if (!updatedRole) {
        // Create new role if none exists
        const currentUserId = (req.user as any).claims.sub;
        await storage.createUserRole({
          userId,
          role,
          isActive: true,
          assignedBy: currentUserId
        });
      }
      
      res.json({ message: "Role updated successfully" });
    } catch (error) {
      console.error('Role update error:', error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });
  
  // User management routes (admin only)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  // User project access routes
  app.post("/api/user-project-access", requireAdmin, async (req, res) => {
    try {
      const access = await storage.createUserProjectAccess(req.body);
      res.status(201).json(access);
    } catch (error) {
      console.error('Create user project access error:', error);
      res.status(500).json({ error: "Failed to create user project access" });
    }
  });
  
  app.delete("/api/user-project-access/:userId/:projectId", requireAdmin, async (req, res) => {
    try {
      const { userId, projectId } = req.params;
      const deleted = await storage.deleteUserProjectAccess(userId, projectId);
      if (!deleted) {
        return res.status(404).json({ error: "User project access not found" });
      }
      res.json({ message: "User project access deleted successfully" });
    } catch (error) {
      console.error('Delete user project access error:', error);
      res.status(500).json({ error: "Failed to delete user project access" });
    }
  });
  
  // Vendor Categories Routes (protected)
  app.get("/api/vendor-categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getAllVendorCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendor categories" });
    }
  });

  // Hierarchical category endpoints - MUST come before /:id to avoid conflicts
  app.get("/api/vendor-categories/tree", requireAuth, async (req, res) => {
    try {
      const tree = await storage.getCategoryTree();
      res.json(tree);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category tree" });
    }
  });

  app.get("/api/vendor-categories/:id/children", requireAuth, async (req, res) => {
    try {
      const children = await storage.getChildCategories(req.params.id);
      res.json(children);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch child categories" });
    }
  });

  app.get("/api/vendor-categories/:id/descendants", requireAuth, async (req, res) => {
    try {
      const descendants = await storage.getCategoryWithDescendants(req.params.id);
      res.json(descendants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category descendants" });
    }
  });

  app.get("/api/vendor-categories/:id", requireAuth, async (req, res) => {
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

  app.post("/api/vendor-categories", requireAdmin, async (req, res) => {
    try {
      const parsed = insertVendorCategorySchema.parse(req.body);
      const category = await storage.createVendorCategory(parsed);
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor category data" });
    }
  });

  app.put("/api/vendor-categories/:id", requireAdmin, async (req, res) => {
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

  app.delete("/api/vendor-categories/:id", requireAdmin, async (req, res) => {
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
  app.get("/api/vendors", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method for consistent access control
      const vendors = await storage.getVendorsForUser(userId, userRole.role);
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors-with-projects", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method to get filtered vendors
      const vendors = await storage.getVendorsForUser(userId, userRole.role);
      const projectVendors = await storage.getProjectVendorsForUser(userId, userRole.role);
      
      // Map vendors with their associated projects
      const vendorsWithProjects = vendors.map(vendor => ({
        ...vendor,
        projects: projectVendors.filter(pv => pv.vendorId === vendor.id)
      }));
      
      res.json(vendorsWithProjects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors with projects" });
    }
  });

  app.get("/api/vendors/category/:categoryId", requireAuth, async (req, res) => {
    try {
      const vendors = await storage.getVendorsByCategory(req.params.categoryId);
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors by category" });
    }
  });

  app.get("/api/vendors/by-parent-category/:parentId", requireAuth, async (req, res) => {
    try {
      const vendors = await storage.getVendorsByCategoryWithDescendants(req.params.parentId);
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors by parent category" });
    }
  });

  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
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

  app.post("/api/vendors", requireAdmin, async (req, res) => {
    try {
      const parsed = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(parsed);
      res.status(201).json(vendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });

  app.put("/api/vendors/:id", requireAdmin, async (req, res) => {
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

  app.delete("/api/vendors/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteVendor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting vendor:', error);
      if (error instanceof Error && error.message.includes("Cannot delete vendor with existing quotations")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });

  // Projects Routes (protected)
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method for consistent access control
      const projects = await storage.getProjectsForUser(userId, userRole.role);
      res.json(projects);
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Get user's accessible projects and check if this project is included
      const userProjects = await storage.getProjectsForUser(userId, userRole.role);
      const project = userProjects.find(p => p.id === req.params.id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found or access denied" });
      }
      
      res.json(project);
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", requireAdmin, async (req, res) => {
    try {
      const parsed = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(parsed);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  app.put("/api/projects/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, parsed);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  app.delete("/api/projects/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Project Vendors Routes
  app.get("/api/project-vendors", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method for consistent access control
      const projectVendors = await storage.getProjectVendorsForUser(userId, userRole.role);
      res.json(projectVendors);
    } catch (error) {
      console.error('Get project vendors error:', error);
      res.status(500).json({ error: "Failed to fetch project vendors" });
    }
  });

  app.get("/api/project-vendors/project/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const projectId = req.params.projectId;
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method with project ID filter
      const projectVendors = await storage.getProjectVendorsForUser(userId, userRole.role, projectId);
      res.json(projectVendors);
    } catch (error) {
      console.error('Get project vendors by project error:', error);
      res.status(500).json({ error: "Failed to fetch project vendors" });
    }
  });

  app.post("/api/project-vendors", requireAuth, async (req, res) => {
    try {
      const parsed = insertProjectVendorSchema.parse(req.body);
      const projectVendor = await storage.createProjectVendor(parsed);
      res.status(201).json(projectVendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid project vendor data" });
    }
  });

  // Upsert project vendor to prevent duplicates
  app.post("/api/project-vendors/upsert", requireAuth, async (req, res) => {
    try {
      const parsed = insertProjectVendorSchema.parse(req.body);
      const projectVendor = await storage.upsertProjectVendor(parsed);
      res.status(201).json(projectVendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid project vendor data" });
    }
  });

  app.put("/api/project-vendors/:id", requireAuth, async (req, res) => {
    try {
      const parsed = insertProjectVendorSchema.partial().parse(req.body);
      const projectVendor = await storage.updateProjectVendor(req.params.id, parsed);
      if (!projectVendor) {
        return res.status(404).json({ error: "Project vendor not found" });
      }
      res.json(projectVendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid project vendor data" });
    }
  });

  // Delete a project vendor
  app.delete("/api/project-vendors/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteProjectVendor(req.params.id);
      if (success) {
        res.json({ message: "Project vendor deleted successfully" });
      } else {
        res.status(404).json({ error: "Project vendor not found" });
      }
    } catch (error) {
      console.error('Error deleting project vendor:', error);
      res.status(500).json({ error: "Failed to delete project vendor" });
    }
  });

  // Quotations API - aggregated data for comparative quotes (protected)
  app.get("/api/quotations", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRoleData = await storage.getUserRole(userId);
      
      if (!userRoleData) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      const userRole = userRoleData.role;
      
      // Get all project vendors
      const projectVendors = await storage.getAllProjectVendors();
      
      // Get all projects and vendors for joining
      const allProjects = await storage.getAllProjects();
      const vendors = await storage.getAllVendors();
      const categories = await storage.getAllVendorCategories();
      
      // Filter projects based on user role and access
      let projects = allProjects;
      if (userRole === 'client') {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }
        projects = allProjects.filter(project => project.clientEmail === user.email);
      }
      
      // Create lookup maps for performance
      const projectMap = new Map(projects.map(p => [p.id, p]));
      const vendorMap = new Map(vendors.map(v => [v.id, v]));
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      
      // Transform project vendors into quotation format grouped by project
      const quotationsByProject: Record<string, any[]> = {};
      
      projectVendors.forEach(pv => {
        const project = projectMap.get(pv.projectId);
        const vendor = vendorMap.get(pv.vendorId);
        const category = vendor ? categoryMap.get(vendor.categoryId) : null;
        
        // Only include project vendors for projects the user has access to
        if (project && vendor && category && projects.some(p => p.id === project.id)) {
          if (!quotationsByProject[pv.projectId]) {
            quotationsByProject[pv.projectId] = [];
          }
          
          quotationsByProject[pv.projectId].push({
            id: pv.id,
            vendorName: vendor.name,
            category: category.name,
            quotationName: pv.quotationName,
            quotationType: pv.quotationType,
            quotationValue: pv.quotationValue,
            dateOfQuotation: pv.dateOfQuotation,
            status: pv.status,
            quotationFile: pv.quotationFile,
            notes: pv.notes,
            projectId: pv.projectId,
            projectName: project.projectName
          });
        }
      });
      
      res.json({
        projects: projects,
        quotations: quotationsByProject
      });
    } catch (error) {
      console.error('Error fetching quotations:', error);
      res.status(500).json({ error: "Failed to fetch quotations" });
    }
  });

  // Quote Templates Routes
  app.get("/api/quote-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getAllQuoteTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote templates" });
    }
  });

  app.get("/api/quote-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getQuoteTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // Download Excel file route
  app.get("/api/quote-templates/:id/download", requireAuth, async (req, res) => {
    try {
      const template = await storage.getQuoteTemplateWithFileData(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // If template has original file data, serve the original Excel file
      if (template.originalFileData && template.originalFileName) {
        // Decode the Base64 data back to binary
        const excelBuffer = Buffer.from(template.originalFileData, 'base64');
        
        // Use original MIME type or default to Excel
        const contentType = template.originalMimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        
        // Set headers for download using original filename and MIME type
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${template.originalFileName}"`);
        res.setHeader('Content-Length', excelBuffer.length);
        
        res.send(excelBuffer);
      } else if (template.fields && typeof template.fields === 'object' && 
          (template.fields as any).type === 'spreadsheet' && (template.fields as any).data) {
        
        // Fallback: recreate Excel file from spreadsheet data if no original file
        const spreadsheetData = (template.fields as any).data as any[][];
        
        // Create Excel workbook from the spreadsheet data
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(spreadsheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        
        // Generate Excel buffer
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        
        // Set headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
        res.setHeader('Content-Length', excelBuffer.length);
        
        res.send(excelBuffer);
      } else {
        res.status(400).json({ error: "No Excel data available for download" });
      }
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: "Failed to download template" });
    }
  });

  app.get("/api/quote-templates/category/:categoryId", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getQuoteTemplatesByCategory(req.params.categoryId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates by category" });
    }
  });

  app.post("/api/quote-templates", requireAdmin, async (req, res) => {
    try {
      const parsed = insertQuoteTemplateSchema.parse(req.body);
      const template = await storage.createQuoteTemplate(parsed);
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ error: "Invalid template data" });
    }
  });

  app.put("/api/quote-templates/:id", async (req, res) => {
    try {
      const parsed = insertQuoteTemplateSchema.partial().parse(req.body);
      const template = await storage.updateQuoteTemplate(req.params.id, parsed);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: "Invalid template data" });
    }
  });

  // Configure multer for file uploads (using memoryStorage for object storage)
  const upload = multer({
    storage: multer.memoryStorage(), // Store in memory, then upload to object storage
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1, // Only allow single file upload
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/pdf', // .pdf for reference files
      ];
      
      // Also check file extension as MIME types can be unreliable
      const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only Excel (.xlsx, .xls), CSV, and PDF files are allowed.'));
      }
    }
  });

  // Configure multer for moodboard uploads (using memoryStorage for object storage)
  const uploadMoodboard = multer({
    storage: multer.memoryStorage(), // Store in memory, then upload to object storage
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1, // Only allow single file upload
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg', 
        'image/png',
        'image/svg+xml',
        'image/webp',
        'application/pdf', // PDF exports from Canva
      ];
      
      // Also check file extension as MIME types can be unreliable
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.svg', '.webp', '.pdf'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images (JPEG, PNG, SVG, WebP) and PDF files are allowed.'));
      }
    }
  });

  // Helper function to extract quote data from PDF text
  const extractQuoteDataFromPDF = (pdfText: string) => {
    const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const extractedData: any[] = [];
    const detectedTotals: any = {};
    
    // Enhanced patterns for quote extraction
    const patterns = {
      // Match amounts/prices: $100, ₹1,000, 100.00, etc.
      amount: /(?:₹|Rs\.?|\$|USD|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/g,
      // Match quantities: 5 nos, 10 units, 2.5 sq ft, etc.
      quantity: /(\d+(?:\.\d+)?)\s*(nos?|units?|pieces?|sq\s*ft|sq\s*m|kg|meter?s?|hrs?|days?)/gi,
      // Match line items (description followed by amount)
      lineItem: /^(.+?)\s+(?:₹|Rs\.?|\$)?\s*([0-9,]+(?:\.[0-9]{2})?)$/,
      // Match table-like data with multiple columns
      tableRow: /^(.+?)\s+(\d+(?:\.\d+)?)\s+(.+?)\s+([0-9,]+(?:\.[0-9]{2})?)(?:\s+([0-9,]+(?:\.[0-9]{2})?))?$/,
      // Enhanced total detection patterns - more precise for invoice formats
      grandTotal: /(grand\s*total|net\s*total|total\s*amount|final\s*total|amount\s*due|total\s*payable|balance\s*due|total)[\s:]*(?:₹|Rs\.?|\$|USD|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      finalAmountWithEOE: /([0-9]{7,}(?:\.[0-9]{2})?)\s*E\.\s*&\s*O\.E\./gi, // Amount just before "E. & O.E."
      finalAmountStandalone: /^([0-9]{7,}(?:\.[0-9]{2})?)$/gm, // Standalone 7+ digit number on its own line
      subTotal: /(sub\s*total|subtotal|total\s*before\s*tax)[\s:]*(?:₹|Rs\.?|\$|USD|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      tax: /(gst\s*@\s*18%|tax)[\s:]*(?:₹|Rs\.?|\$|USD|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi
    };
    
    let currentSection = '';
    let itemCounter = 1;
    
    // Helper function to parse currency amounts
    const parseCurrency = (amountStr: string) => {
      return parseFloat(amountStr.replace(/[₹,\$Rs\s]/g, '')) || 0;
    };
    
    // First pass: Scan for total amounts throughout the document
    for (const line of lines) {
      // Look for grand total patterns (including "Total1202104.59" format)
      const grandTotalMatches = Array.from(line.matchAll(patterns.grandTotal));
      if (grandTotalMatches.length > 0) {
        const lastMatch = grandTotalMatches[grandTotalMatches.length - 1];
        const amount = parseCurrency(lastMatch[2]);
        if (!detectedTotals.grandTotal || amount > detectedTotals.grandTotal) {
          detectedTotals.grandTotal = amount;
          detectedTotals.grandTotalLine = line;
        }
      }
      
      // Look for final amount patterns - amounts before "E. & O.E."
      const finalAmountEOEMatches = Array.from(line.matchAll(patterns.finalAmountWithEOE));
      if (finalAmountEOEMatches.length > 0) {
        const lastMatch = finalAmountEOEMatches[finalAmountEOEMatches.length - 1];
        const amount = parseCurrency(lastMatch[1]);
        if (amount > 100000) { // Only consider significant amounts
          detectedTotals.finalAmount = amount;
          detectedTotals.finalAmountLine = line;
        }
      }
      
      // Look for standalone final amounts (7+ digits on their own line)
      const finalAmountStandaloneMatches = Array.from(line.matchAll(patterns.finalAmountStandalone));
      if (finalAmountStandaloneMatches.length > 0 && !detectedTotals.finalAmount) {
        const lastMatch = finalAmountStandaloneMatches[finalAmountStandaloneMatches.length - 1];
        const amount = parseCurrency(lastMatch[1]);
        if (amount > 100000 && amount < 100000000) { // Reasonable invoice amount range
          detectedTotals.finalAmount = amount;
          detectedTotals.finalAmountLine = line;
        }
      }
      
      // Look for subtotal patterns
      const subTotalMatches = Array.from(line.matchAll(patterns.subTotal));
      if (subTotalMatches.length > 0) {
        const lastMatch = subTotalMatches[subTotalMatches.length - 1];
        detectedTotals.subTotal = parseCurrency(lastMatch[2]);
      }
      
      // Look for tax patterns
      const taxMatches = Array.from(line.matchAll(patterns.tax));
      if (taxMatches.length > 0) {
        const lastMatch = taxMatches[taxMatches.length - 1];
        detectedTotals.tax = parseCurrency(lastMatch[2]); // Fixed: use group 2 (amount) not group 1 (label)
      }
    }
    
    // Prioritize final amount over grand total
    if (detectedTotals.finalAmount && detectedTotals.finalAmount > (detectedTotals.grandTotal || 0)) {
      detectedTotals.grandTotal = detectedTotals.finalAmount;
      detectedTotals.grandTotalLine = detectedTotals.finalAmountLine;
    }
    
    // Optional: Log total detection for troubleshooting (can be removed in production)
    if (detectedTotals.grandTotal) {
      console.log(`PDF Total Detection: Found grand total ${detectedTotals.grandTotal}`);
    }
    
    // Second pass: Extract line items
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip headers and common quote document sections
      if (line.toLowerCase().includes('quotation') || 
          line.toLowerCase().includes('estimate') ||
          line.toLowerCase().includes('bill of quantities') ||
          line.toLowerCase().includes('boq')) {
        currentSection = line;
        continue;
      }
      
      // Skip lines that contain total keywords (we already extracted totals)
      if (patterns.grandTotal.test(line) || patterns.subTotal.test(line) || patterns.tax.test(line)) {
        continue;
      }
      
      // Try to match table-like rows (item, qty, unit, rate, amount)
      const tableMatch = line.match(patterns.tableRow);
      if (tableMatch) {
        const [, description, quantity, unit, unitRate, totalAmount] = tableMatch;
        
        extractedData.push({
          'description': description.trim(),
          'quantity': parseFloat(quantity) || 1,
          'unit': unit.trim() || 'unit',
          'unit rate': parseFloat(unitRate.replace(/,/g, '')) || 0,
          'amount': parseFloat((totalAmount || unitRate).replace(/,/g, '')) || 0,
          'category': currentSection || 'General'
        });
        continue;
      }
      
      // Try to match simple line items (description + amount)
      const lineItemMatch = line.match(patterns.lineItem);
      if (lineItemMatch) {
        const [, description, amount] = lineItemMatch;
        
        // Skip if description is too short or looks like a header
        if (description.length < 5) {
          continue;
        }
        
        extractedData.push({
          'description': description.trim(),
          'quantity': 1,
          'unit': 'unit',
          'unit rate': parseFloat(amount.replace(/,/g, '')) || 0,
          'amount': parseFloat(amount.replace(/,/g, '')) || 0,
          'category': currentSection || 'General'
        });
        continue;
      }
      
      // Look for quantity and amount patterns in the same line
      const quantityMatches = Array.from(line.matchAll(patterns.quantity));
      const amountMatches = Array.from(line.matchAll(patterns.amount));
      
      if (quantityMatches.length > 0 && amountMatches.length > 0) {
        // Extract description (text before quantity)
        const qtyMatch = quantityMatches[0];
        const amtMatch = amountMatches[amountMatches.length - 1]; // Use last amount match
        
        const qtyIndex = line.indexOf(qtyMatch[0]);
        const description = line.substring(0, qtyIndex).trim();
        
        if (description.length > 3) {
          extractedData.push({
            'description': description,
            'quantity': parseFloat(qtyMatch[1]) || 1,
            'unit': qtyMatch[2] || 'unit',
            'unit rate': parseFloat(amtMatch[1].replace(/,/g, '')) || 0,
            'amount': parseFloat(amtMatch[1].replace(/,/g, '')) || 0,
            'category': currentSection || 'General'
          });
        }
      }
    }
    
    // If no structured data found but we have a grand total, create a single item
    if (extractedData.length === 0 && detectedTotals.grandTotal) {
      extractedData.push({
        'description': 'PDF Quote - Total Amount',
        'quantity': 1,
        'unit': 'lump sum',
        'unit rate': detectedTotals.grandTotal,
        'amount': detectedTotals.grandTotal,
        'category': 'General'
      });
    }
    
    // If still no data, fall back to finding the largest amount
    if (extractedData.length === 0) {
      const amounts = [];
      for (const line of lines) {
        const matches = Array.from(line.matchAll(patterns.amount));
        amounts.push(...matches.map(m => parseFloat(m[1].replace(/,/g, ''))));
      }
      
      if (amounts.length > 0) {
        const maxAmount = Math.max(...amounts);
        extractedData.push({
          'description': 'PDF Quote - Imported from document',
          'quantity': 1,
          'unit': 'lump sum',
          'unit rate': maxAmount,
          'amount': maxAmount,
          'category': 'General'
        });
      }
    }
    
    // Return both line items and detected totals
    return {
      items: extractedData,
      totals: detectedTotals
    };
  };

  // Helper function to parse Excel/CSV/PDF files
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
        // Parse Excel file - use fs.readFileSync + XLSX.read for ESM compatibility
        const buffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(buffer);
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
      } else if (mimeType.includes('pdf') || filePath.toLowerCase().endsWith('.pdf')) {
        // Parse PDF file
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        const text = pdfData.text;
        
        // Extract quote information using pattern matching
        const result = extractQuoteDataFromPDF(text);
        
        // Return both items and totals for PDF processing
        return {
          items: result.items,
          totals: result.totals,
          originalFormat: 'pdf'
        };
      }
      
      return { items: [], totals: {}, originalFormat: 'unknown' };
    } catch (error) {
      console.error('Error parsing file:', error);
      throw new Error('Failed to parse file');
    }
  };

  // Helper function to process quote data and create records
  const processQuoteImport = async (data: any, projectId: string, vendorId: string, importParams?: {
    quotationName?: string;
    quotationType?: string;
    itemCategory?: string;
    parentQuotationId?: string;
  }) => {
    const results = {
      projectVendor: null as any,
      boqItems: [] as any[],
      errors: [] as string[]
    };

    try {
      // Handle different data formats (PDF vs Excel/CSV)
      const items = data.items || data;
      const totals = data.totals || {};
      const originalFormat = data.originalFormat || 'unknown';
      
      // Calculate total quotation value, preferring detected grand total
      let totalValue = 0;
      let useDetectedTotal = false;
      const boqItems = [];

      // Use detected grand total from PDF if available
      if (totals.grandTotal && totals.grandTotal > 0) {
        totalValue = totals.grandTotal;
        useDetectedTotal = true;
        console.log(`Using detected grand total from PDF: ${totalValue}`);
      }

      for (const row of items) {
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
          
          // Validate that values don't exceed database limits (precision 10, scale 2)
          const maxValue = 99999999.99;
          
          if (item.quantity > maxValue) {
            results.errors.push(`Quantity ${item.quantity} for "${item.description}" exceeds maximum allowed value (${maxValue})`);
            continue;
          }
          
          if (item.unitRate > maxValue) {
            results.errors.push(`Unit rate ${item.unitRate} for "${item.description}" exceeds maximum allowed value (${maxValue})`);
            continue;
          }
          
          if (totalAmount > maxValue) {
            results.errors.push(`Total amount ${totalAmount.toFixed(2)} for "${item.description}" exceeds maximum allowed value (${maxValue})`);
            continue;
          }
          
          // Only add to total if we're not using a detected grand total from PDF
          if (!useDetectedTotal) {
            totalValue += totalAmount;
          }
          
          // Additional check for total value overflow (only when calculating)
          if (!useDetectedTotal && totalValue > maxValue) {
            results.errors.push(`Total quotation value ${totalValue.toFixed(2)} exceeds maximum allowed value (${maxValue}). Some items may be skipped.`);
            totalValue = maxValue;
            break;
          }
          
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
        notes: `Imported ${boqItems.length} BOQ items`,
        quotationName: importParams?.quotationName || "Main Quote",
        quotationType: importParams?.quotationType || "item",
        itemCategory: importParams?.itemCategory || null,
        parentQuotationId: importParams?.parentQuotationId || null
      };

      // Use createProjectVendor when we have importParams to ensure multiple quotes are created
      const projectVendor = importParams 
        ? await storage.createProjectVendor(projectVendorData)
        : await storage.upsertProjectVendor(projectVendorData);
      
      if (!projectVendor) {
        throw new Error('Failed to create project vendor record');
      }
      
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
      console.error('Processing error in processQuoteImport:', error);
      throw error; // Re-throw the error instead of silently continuing
    }

    return results;
  };

  // Quote Import Routes
  app.post("/api/quotes/import", requireAuth, upload.single('quoteFile'), async (req, res) => {
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

      // Check if vendor already has quotes for this project (only count records with actual quote data)
      const allProjectVendors = await storage.getProjectVendors(projectId);
      const existingQuotes = allProjectVendors.filter(pv => 
        pv.vendorId === vendorId && 
        pv.quotationValue !== null && 
        pv.quotationValue !== undefined
      );
      
      if (existingQuotes.length > 0) {
        // Store the parsed data temporarily and return conflict response
        return res.status(409).json({
          conflictType: "existing_quotes",
          message: "This vendor already has quotes for this project. Please specify if this is an option for existing items or a new item category.",
          existingQuotes: existingQuotes.map(quote => ({
            id: quote.id,
            quotationName: quote.quotationName || "Main Quote",
            quotationType: quote.quotationType || "item",
            quotationValue: quote.quotationValue,
            itemCategory: quote.itemCategory
          })),
          tempFileId: req.file.filename, // Store the temp file identifier
          parsedDataPreview: {
            totalItems: (data.items || data).length,
            estimatedValue: data.totals?.grandTotal || 0
          }
        });
      }

      // Process the quote import (no conflict)
      const results = await processQuoteImport(data, projectId, vendorId);
      
      // Store file information - keep the uploaded file
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

      // Don't delete the file - keep it for viewing
      console.log(`Stored quote file at: ${filePath}`);

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

  // Resolve import conflict - when user decides if it's option or new item
  app.post("/api/quotes/import/resolve", requireAuth, async (req, res) => {
    try {
      const { 
        tempFileId, 
        projectId, 
        vendorId, 
        resolutionType, 
        quotationName, 
        itemCategory, 
        parentQuotationId 
      } = req.body;
      
      if (!tempFileId || !projectId || !vendorId || !resolutionType) {
        return res.status(400).json({ 
          error: "Missing required parameters: tempFileId, projectId, vendorId, resolutionType" 
        });
      }

      if (resolutionType === "option" && !parentQuotationId) {
        return res.status(400).json({ 
          error: "parentQuotationId is required when resolutionType is 'option'" 
        });
      }

      if (resolutionType === "new_item" && (!quotationName || !itemCategory)) {
        return res.status(400).json({ 
          error: "quotationName and itemCategory are required when resolutionType is 'new_item'" 
        });
      }

      // Reconstruct file path from tempFileId
      const tempFilePath = path.join('uploads', tempFileId);
      
      if (!fs.existsSync(tempFilePath)) {
        return res.status(404).json({ error: "Temporary file not found. Please re-upload the file." });
      }

      // Determine file type
      const extension = path.extname(tempFileId).toLowerCase();
      let mimeType = 'application/octet-stream';
      if (extension === '.xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (extension === '.xls') mimeType = 'application/vnd.ms-excel';
      else if (extension === '.csv') mimeType = 'text/csv';
      else if (extension === '.pdf') mimeType = 'application/pdf';

      // Re-parse the file
      const data = await parseQuoteFile(tempFilePath, mimeType);
      
      if (!data || data.length === 0) {
        return res.status(400).json({ error: "No valid data found in temporary file" });
      }

      // Set up parameters based on resolution type
      let finalQuotationName = quotationName || "Main Quote";
      
      // For options, automatically generate option names if not provided
      if (resolutionType === "option" && (!quotationName || quotationName === "Main Quote")) {
        // Get existing options for the parent quote to determine next option number
        const allProjectVendors = await storage.getProjectVendors(projectId);
        const existingOptions = allProjectVendors.filter(pv => 
          pv.vendorId === vendorId && 
          pv.quotationType === "option" && 
          pv.parentQuotationId === parentQuotationId
        );
        
        const optionNumber = existingOptions.length + 1;
        finalQuotationName = `Option ${optionNumber}`;
      }
      
      const importParams = {
        quotationName: finalQuotationName,
        quotationType: resolutionType === "option" ? "option" : "item",
        itemCategory: itemCategory || null,
        parentQuotationId: resolutionType === "option" ? parentQuotationId : null
      };

      // Process the quote import with additional parameters
      const results = await processQuoteImport(data, projectId, vendorId, importParams);
      
      // Store file information
      const filePath = `/uploads/${tempFileId}`;
      const quoteFileData = {
        projectVendorId: results.projectVendor.id,
        fileName: `${quotationName || "Quote"}.${extension.substring(1)}`,
        filePath: filePath,
        fileType: extension,
        fileSize: fs.statSync(tempFilePath).size.toString()
      };
      
      await storage.createQuoteFile(quoteFileData);

      // Update project vendor with file path
      await storage.updateProjectVendor(results.projectVendor.id, {
        quotationFile: filePath
      });

      res.status(201).json({
        message: "Quote imported successfully",
        projectVendor: results.projectVendor,
        boqItems: results.boqItems,
        totalItems: results.boqItems.length,
        totalValue: results.projectVendor.quotationValue,
        errors: results.errors
      });

    } catch (error) {
      console.error('Resolve import conflict error:', error);
      
      res.status(500).json({ 
        error: "Failed to resolve import conflict",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Template processing functions
  const parseTemplateFile = async (filePath: string, mimeType: string): Promise<any[]> => {
    try {
      if (mimeType.includes('excel') || mimeType.includes('sheet')) {
        // Parse Excel file - use fs.readFileSync + XLSX.read for ESM compatibility
        const buffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(buffer, { cellText: false, cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get the raw data without parsing headers first to inspect structure
        const rawData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, // Use array format first
          defval: '',
          blankrows: false
        });
        
        console.log('Raw Excel data structure:', JSON.stringify(rawData.slice(0, 3), null, 2));
        
        // Find the first non-empty row that could be headers
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, rawData.length); i++) {
          const row = rawData[i] as any[];
          if (row && row.some(cell => cell && String(cell).trim() !== '')) {
            // Check if this row looks like headers (non-numeric strings)
            const nonEmptyCells = row.filter(cell => cell && String(cell).trim() !== '');
            const textCells = nonEmptyCells.filter(cell => isNaN(Number(cell)));
            if (textCells.length > nonEmptyCells.length * 0.5) {
              headerRowIndex = i;
              break;
            }
          }
        }
        
        console.log('Using header row index:', headerRowIndex);
        
        // Parse with proper headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          range: headerRowIndex, // Start from header row
          defval: '',
          blankrows: false
        });
        
        console.log('Parsed Excel data:', JSON.stringify(jsonData.slice(0, 2), null, 2));
        return jsonData;
      } else if (mimeType.includes('csv')) {
        // Parse CSV file
        const csvData = fs.readFileSync(filePath, 'utf8');
        const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
        return parsed.data as any[];
      }
      return [];
    } catch (error) {
      console.error('Error parsing template file:', error);
      return [];
    }
  };

  const processTemplateImport = async (data: any[], categoryId: string, rawExcelData?: any[][], originalFileData?: string, originalFileName?: string, originalMimeType?: string) => {
    const results = {
      template: null as any,
      fields: [] as any[],
      errors: [] as string[]
    };

    try {
      // Analyze the data to extract template structure
      if (data.length === 0) {
        results.errors.push('No data found in file');
        return results;
      }

      // Generate template name from filename or default
      const templateName = `Imported Template ${new Date().toLocaleDateString()}`;
      
      // Store the raw Excel data as spreadsheet format
      const spreadsheetData = {
        type: 'spreadsheet',
        data: rawExcelData || data,
        rowCount: rawExcelData ? rawExcelData.length : data.length,
        columnCount: rawExcelData ? Math.max(...rawExcelData.map(row => row.length)) : Object.keys(data[0]).length
      };
      
      // Create the template with spreadsheet data
      const templateData = {
        name: templateName,
        description: `Template imported from Excel file with ${spreadsheetData.rowCount} rows and ${spreadsheetData.columnCount} columns`,
        categoryId: categoryId,
        fields: spreadsheetData, // Store raw spreadsheet data instead of parsed fields
        originalFileData: originalFileData, // Store original Excel file as Base64
        originalFileName: originalFileName, // Store original filename
        originalMimeType: originalMimeType, // Store original MIME type
        isActive: true
      };

      results.template = await storage.createQuoteTemplate(templateData);
      results.fields = []; // No individual fields since we're storing as spreadsheet

    } catch (error) {
      results.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return results;
  };

  // Template Import Routes
  app.post("/api/quote-templates/import", requireAdmin, upload.single('templateFile'), async (req, res) => {
    let tempFilePath: string | undefined;
    let statusCode = 500;
    let responseData: any = { error: "Failed to import template" };

    try {
      if (!req.file) {
        statusCode = 400;
        responseData = { error: "No file uploaded" };
        return;
      }

      tempFilePath = req.file.path;
      const { categoryId } = req.body;
      
      if (!categoryId) {
        statusCode = 400;
        responseData = { error: "Category ID is required" };
        return;
      }

      // Verify category exists
      const category = await storage.getVendorCategory(categoryId);
      
      if (!category) {
        statusCode = 404;
        responseData = { error: "Category not found" };
        return;
      }

      // Parse the uploaded file
      const data = await parseTemplateFile(req.file.path, req.file.mimetype);
      
      if (!data || data.length === 0) {
        statusCode = 400;
        responseData = { error: "No valid data found in file" };
        return;
      }

      // Get raw Excel data for spreadsheet storage
      const buffer = fs.readFileSync(req.file.path);
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawExcelData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '',
        blankrows: false
      });

      // Store original file data as Base64 for downloads
      const originalFileData = buffer.toString('base64');
      const originalFileName = req.file.originalname;
      const originalMimeType = req.file.mimetype;

      // Process the template import with raw Excel data and original file
      const results = await processTemplateImport(data, categoryId, rawExcelData as any[][], originalFileData, originalFileName, originalMimeType);
      
      if (!results.template) {
        statusCode = 400;
        responseData = { error: "Failed to create template" };
        return;
      }

      // Success case
      statusCode = 201;
      responseData = {
        message: "Template imported successfully",
        template: results.template,
        fields: results.fields,
        totalFields: results.fields.length,
        errors: results.errors
      };

    } catch (error) {
      console.error('Template import error:', error);
      statusCode = 500;
      responseData = { 
        error: "Failed to import template",
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      // Guaranteed cleanup of temporary file
      if (tempFilePath) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          console.warn('Failed to clean up temporary file:', e);
        }
      }
      
      // Send response
      res.status(statusCode).json(responseData);
    }
  });

  // Get BOQ items for a project vendor (protected)
  app.get("/api/project-vendors/:id/boq", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const projectVendorId = req.params.id;
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method for consistent access control
      const boqItems = await storage.getBOQForUser(userId, userRole.role, projectVendorId);
      res.json(boqItems);
    } catch (error) {
      console.error('Get BOQ error:', error);
      res.status(500).json({ error: "Failed to fetch BOQ items" });
    }
  });

  // Get quote files for a project vendor (protected)
  app.get("/api/project-vendors/:id/files", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const projectVendorId = req.params.id;
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method for consistent access control
      const files = await storage.getQuoteFilesForUser(userId, userRole.role, projectVendorId);
      res.json(files);
    } catch (error) {
      console.error('Get quote files error:', error);
      res.status(500).json({ error: "Failed to fetch quote files" });
    }
  });

  // Helper function to format currency for export
  const formatCurrencyForExport = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(parseFloat(value));
  };

  // Helper function to calculate variance percentage
  const calculateVariance = (value: string | null | undefined, average: number) => {
    if (!value || average === 0) return 0;
    const quotationValue = parseFloat(value);
    if (isNaN(quotationValue)) return 0;
    return ((quotationValue - average) / average) * 100;
  };

  // Validation schema for export request with field length limits
  const exportRequestSchema = z.object({
    filters: z.object({
      project: z.string().max(100),
      category: z.string().max(100)
    }),
    quotations: z.array(z.object({
      id: z.string().max(50),
      vendorName: z.string().max(200),
      category: z.string().max(100),
      quotationValue: z.string().max(20).nullable(),
      dateOfQuotation: z.string().max(50).nullable(),
      status: z.enum(["Quoted", "Selected", "Rejected"]),
      quotationFile: z.string().max(500).optional().nullable(),
      notes: z.string().max(1000).optional(),
      projectId: z.string().max(50),
      projectName: z.string().max(200)
    })).max(5000), // Limit number of quotations
    groupedData: z.array(z.object({
      key: z.string().max(100),
      category: z.string().max(100),
      projectName: z.string().max(200),
      projectId: z.string().max(50),
      quotations: z.array(z.any()).max(1000), // Limit quotations per group
      average: z.number().optional() // We'll recompute this server-side
    })).max(100) // Limit number of groups
  });

  // Helper function to safely parse and format date
  const safeDateFormat = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-IN');
    } catch {
      return 'Invalid Date';
    }
  };

  // Helper function to calculate group average
  const calculateGroupAverage = (quotations: any[]) => {
    if (quotations.length === 0) return 0;
    const sum = quotations.reduce((acc, q) => {
      if (!q.quotationValue) return acc;
      const value = parseFloat(q.quotationValue);
      return acc + (isNaN(value) ? 0 : value);
    }, 0);
    return sum / quotations.length;
  };

  // Enhanced helper function to sanitize text for CSV/Excel export to prevent formula injection
  const sanitizeForExport = (text: string | undefined | null): string => {
    if (!text) return '';
    const stringValue = String(text);
    
    // Remove control characters
    let sanitized = stringValue.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Check if the first non-whitespace character is potentially dangerous
    const dangerousChars = ['=', '+', '-', '@', '\t', '\r', '\n'];
    const trimmed = sanitized.trim();
    const firstNonWhitespaceChar = trimmed.charAt(0);
    
    if (dangerousChars.includes(firstNonWhitespaceChar)) {
      // Prefix with single quote to prevent formula execution
      return `'${sanitized}`;
    }
    
    return sanitized;
  };

  // Export quotes endpoint
  app.post("/api/quotes/export/:format", requireAuth, async (req, res) => {
    try {
      const { format } = req.params;

      // Strict format validation
      if (!['csv', 'excel'].includes(format)) {
        return res.status(400).json({ 
          error: "Invalid export format. Supported formats: csv, excel. PDF export is temporarily unavailable." 
        });
      }

      // Validate request body
      const parsed = exportRequestSchema.parse(req.body);
      const { filters, quotations, groupedData } = parsed;

      // Validate request body size
      if (quotations.length > 10000) {
        return res.status(400).json({ error: "Too many quotations to export. Maximum 10,000 records allowed." });
      }

      // Prepare export data with server-side computation
      const exportRows: any[] = [];
      
      // Recompute averages and variances server-side for data integrity
      groupedData.forEach((group) => {
        // Recompute group average server-side (don't trust client data)
        const serverAverage = calculateGroupAverage(group.quotations);
        
        group.quotations.forEach((quotation) => {
          const quotationValue = quotation.quotationValue ? parseFloat(quotation.quotationValue) : 0;
          if (quotation.quotationValue && isNaN(quotationValue)) {
            console.warn(`Invalid quotation value: ${quotation.quotationValue} for quotation ${quotation.id}`);
            return; // Skip invalid records
          }

          const variance = calculateVariance(quotation.quotationValue, serverAverage);
          exportRows.push({
            'Project Name': sanitizeForExport(quotation.projectName || 'Unknown Project'),
            'Category': sanitizeForExport(quotation.category || 'Unknown Category'),
            'Vendor Name': sanitizeForExport(quotation.vendorName || 'Unknown Vendor'),
            'Quote Value (INR)': quotationValue,
            'Quote Value (Formatted)': formatCurrencyForExport(quotation.quotationValue),
            'Variance (%)': variance.toFixed(2),
            'Date of Quotation': safeDateFormat(quotation.dateOfQuotation),
            'Status': sanitizeForExport(quotation.status || 'Unknown'),
            'Category Average (INR)': serverAverage.toFixed(2),
            'Category Average (Formatted)': formatCurrencyForExport(serverAverage.toString()),
            'Notes': sanitizeForExport(quotation.notes || ''),
            'Quote File': sanitizeForExport(quotation.quotationFile || '')
          });
        });
      });

      if (exportRows.length === 0) {
        return res.status(400).json({ error: "No valid data to export" });
      }

      const timestamp = new Date().toISOString().split('T')[0];
      
      if (format === 'csv') {
        // Generate CSV
        const csv = Papa.unparse(exportRows);
        const filename = `quotes_export_${timestamp}.csv`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
      } else if (format === 'excel') {
        // Generate Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        
        // Set column widths for better formatting
        const colWidths = [
          { wch: 25 }, // Project Name
          { wch: 20 }, // Category
          { wch: 25 }, // Vendor Name
          { wch: 15 }, // Quote Value (INR)
          { wch: 20 }, // Quote Value (Formatted)
          { wch: 12 }, // Variance (%)
          { wch: 18 }, // Date of Quotation
          { wch: 12 }, // Status
          { wch: 18 }, // Category Average (INR)
          { wch: 25 }, // Category Average (Formatted)
          { wch: 30 }, // Notes
          { wch: 25 }  // Quote File
        ];
        worksheet['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotes Export');
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const filename = `quotes_export_${timestamp}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
      }

    } catch (error) {
      console.error('Export error:', error);
      
      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: "Please ensure all required fields are properly formatted"
        });
      }
      
      res.status(500).json({ 
        error: "Failed to export quotes",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Individual quote export endpoint
  app.post("/api/quotes/export/individual/:format", requireAuth, async (req, res) => {
    try {
      const { format } = req.params;

      // Strict format validation with explicit allow-list
      const allowedFormats = ['csv', 'excel', 'pdf'] as const;
      if (!allowedFormats.includes(format as any)) {
        return res.status(400).json({ 
          error: "Invalid export format. Supported formats: csv, excel, pdf." 
        });
      }

      // Validation schema for individual quote export
      const individualQuoteSchema = z.object({
        quotation: z.object({
          id: z.string().max(50),
          vendorName: z.string().max(200),
          category: z.string().max(100),
          quotationValue: z.string().max(20).nullable(),
          dateOfQuotation: z.string().max(50).nullable(),
          status: z.enum(["Quoted", "Selected", "Rejected"]),
          quotationFile: z.string().max(500).optional().nullable(),
          notes: z.string().max(1000),
          projectName: z.string().max(200),
          projectId: z.string().max(50)
        }),
        metadata: z.object({
          exportDate: z.string(),
          exportType: z.string()
        })
      });

      // Validate request body
      const parsed = individualQuoteSchema.parse(req.body);
      const { quotation } = parsed;

      // Prepare export data for individual quote
      const quotationValue = quotation.quotationValue ? parseFloat(quotation.quotationValue) : 0;
      if (quotation.quotationValue && isNaN(quotationValue)) {
        return res.status(400).json({ error: "Invalid quotation value" });
      }

      const exportRow = {
        'Vendor Name': sanitizeForExport(quotation.vendorName),
        'Project Name': sanitizeForExport(quotation.projectName),
        'Category': sanitizeForExport(quotation.category),
        'Quote Value (INR)': quotationValue,
        'Quote Value (Formatted)': formatCurrencyForExport(quotation.quotationValue),
        'Date of Quotation': safeDateFormat(quotation.dateOfQuotation),
        'Status': sanitizeForExport(quotation.status),
        'Notes': sanitizeForExport(quotation.notes),
        'Quote File': sanitizeForExport(quotation.quotationFile),
        'Quote ID': sanitizeForExport(quotation.id),
        'Exported On': safeDateFormat(new Date().toISOString())
      };

      const timestamp = new Date().toISOString().split('T')[0];
      const vendorName = quotation.vendorName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

      if (format === 'csv') {
        const csv = Papa.unparse([exportRow]);
        const filename = `quote_${vendorName}_${timestamp}.csv`;
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
      } else if (format === 'pdf') {
        // PDF export using PDFKit
        const filename = `quote_${vendorName}_${timestamp}.pdf`;
        
        // Create PDF document
        const doc = new PDFDocument();
        const chunks: Buffer[] = [];
        
        // Collect PDF data
        doc.on('data', (chunk) => chunks.push(chunk));
        
        // Promise to handle PDF generation
        const pdfBuffer = await new Promise<Buffer>((resolve) => {
          doc.on('end', () => {
            resolve(Buffer.concat(chunks));
          });
          
          // PDF Content
          doc.fontSize(20).text('QUOTATION SUMMARY', { align: 'center' });
          doc.moveDown(2);
          
          // Quote details
          doc.fontSize(12);
          doc.text(`Vendor: ${quotation.vendorName}`, { continued: false });
          doc.text(`Project: ${quotation.projectName}`);
          doc.text(`Category: ${quotation.category}`);
          doc.text(`Quote Value: ${exportRow['Quote Value (Formatted)']}`);
          doc.text(`Date: ${exportRow['Date of Quotation']}`);
          doc.text(`Status: ${quotation.status}`);
          doc.text(`Quote ID: ${quotation.id}`);
          
          doc.moveDown();
          doc.text(`Notes: ${quotation.notes || 'No additional notes'}`);
          
          doc.moveDown(2);
          doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' });
          
          doc.end();
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      } else {
        // Excel export
        const XLSX = await import('xlsx');
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet([exportRow]);
        
        // Set column widths for better readability
        const colWidths = [
          { wch: 20 }, // Vendor Name
          { wch: 25 }, // Project Name
          { wch: 15 }, // Category
          { wch: 15 }, // Quote Value (INR)
          { wch: 20 }, // Quote Value (Formatted)
          { wch: 15 }, // Date of Quotation
          { wch: 10 }, // Status
          { wch: 30 }, // Notes
          { wch: 25 }, // Quote File
          { wch: 15 }, // Quote ID
          { wch: 15 }  // Exported On
        ];
        worksheet['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Individual Quote');
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const filename = `quote_${vendorName}_${timestamp}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
      }

    } catch (error) {
      console.error('Individual quote export error:', error);
      
      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: "Please ensure all required fields are properly formatted"
        });
      }
      
      res.status(500).json({ 
        error: "Failed to export individual quote",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Template export endpoint for vendors
  app.post("/api/templates/export/:format", requireAuth, async (req, res) => {
    try {
      const { format } = req.params;

      // Strict format validation with explicit allow-list
      const allowedFormats = ['csv', 'excel'] as const;
      if (!allowedFormats.includes(format as any)) {
        return res.status(400).json({ 
          error: "Invalid export format. Supported formats: csv, excel." 
        });
      }

      // Validation schema for template export
      const templateExportSchema = z.object({
        template: z.object({
          id: z.string().max(50),
          name: z.string().max(200),
          description: z.string().max(1000),
          categoryId: z.string().max(50),
          categoryName: z.string().max(200),
          isActive: z.boolean(),
          createdAt: z.string().optional()
        }),
        metadata: z.object({
          exportDate: z.string(),
          exportType: z.string()
        })
      });

      // Validate request body
      const parsed = templateExportSchema.parse(req.body);
      const { template } = parsed;

      // Create blank template structure for vendor to fill out
      const templateRows = [
        {
          'Item/Service': 'Item Name/Description',
          'Quantity': 'Enter Quantity',
          'Unit': 'Enter Unit (pcs, sqft, etc.)',
          'Rate per Unit (INR)': 'Enter Rate',
          'Total Amount (INR)': 'Quantity × Rate',
          'Notes/Specifications': 'Enter any notes or specifications',
          'Vendor Name': 'Enter your company name',
          'Contact Person': 'Enter contact person name',
          'Phone': 'Enter phone number',
          'Email': 'Enter email address'
        },
        {
          'Item/Service': '(Example) Construction Material',
          'Quantity': '100',
          'Unit': 'sqft',
          'Rate per Unit (INR)': '500',
          'Total Amount (INR)': '50,000',
          'Notes/Specifications': 'High quality material as per specs',
          'Vendor Name': 'Your Company Name',
          'Contact Person': 'John Doe',
          'Phone': '+91-9876543210',
          'Email': 'john@company.com'
        },
        // Add multiple blank rows for vendor to fill
        ...Array(15).fill(null).map(() => ({
          'Item/Service': '',
          'Quantity': '',
          'Unit': '',
          'Rate per Unit (INR)': '',
          'Total Amount (INR)': '',
          'Notes/Specifications': '',
          'Vendor Name': '',
          'Contact Person': '',
          'Phone': '',
          'Email': ''
        }))
      ];

      const timestamp = new Date().toISOString().split('T')[0];
      const templateName = template.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

      if (format === 'csv') {
        // Add header information
        const headerInfo = [
          [`QUOTE TEMPLATE: ${sanitizeForExport(template.name)}`],
          [`Category: ${sanitizeForExport(template.categoryName)}`],
          [`Description: ${sanitizeForExport(template.description)}`],
          [`Export Date: ${new Date().toLocaleDateString()}`],
          [''],
          ['INSTRUCTIONS FOR VENDOR:'],
          ['1. Fill in your company details in the rows below'],
          ['2. Replace example entries with your actual quote items'],
          ['3. Add as many rows as needed for your quote'],
          ['4. Save and send back to client'],
          [''],
          ['QUOTE ITEMS:']
        ];

        const csvContent = headerInfo.map(row => Papa.unparse([row])).join('\n') + '\n' + Papa.unparse(templateRows);
        const filename = `template_${templateName}_${timestamp}.csv`;
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
      } else {
        // Excel export
        const XLSX = await import('xlsx');
        const workbook = XLSX.utils.book_new();
        
        // Create header sheet with template information
        const headerData = [
          ['QUOTE TEMPLATE INFORMATION'],
          ['Template Name:', sanitizeForExport(template.name)],
          ['Category:', sanitizeForExport(template.categoryName)],
          ['Description:', sanitizeForExport(template.description)],
          ['Export Date:', new Date().toLocaleDateString()],
          [''],
          ['INSTRUCTIONS FOR VENDOR:'],
          ['1. Fill in your company details in the rows below'],
          ['2. Replace example entries with your actual quote items'],
          ['3. Add as many rows as needed for your quote'],
          ['4. Calculate totals and save file'],
          ['5. Send completed quote back to client'],
          [''],
          ['Please scroll to "Quote Template" sheet to fill in your quote details']
        ];

        const headerSheet = XLSX.utils.aoa_to_sheet(headerData);
        XLSX.utils.book_append_sheet(workbook, headerSheet, 'Instructions');

        // Create main template sheet
        const templateSheet = XLSX.utils.json_to_sheet(templateRows);
        
        // Set column widths for better readability
        const colWidths = [
          { wch: 30 }, // Item/Service
          { wch: 10 }, // Quantity
          { wch: 10 }, // Unit
          { wch: 15 }, // Rate per Unit
          { wch: 20 }, // Total Amount
          { wch: 40 }, // Notes/Specifications
          { wch: 20 }, // Vendor Name
          { wch: 20 }, // Contact Person
          { wch: 15 }, // Phone
          { wch: 25 }  // Email
        ];
        templateSheet['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(workbook, templateSheet, 'Quote Template');
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const filename = `template_${templateName}_${timestamp}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
      }

    } catch (error) {
      console.error('Template export error:', error);
      
      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: "Please ensure all required fields are properly formatted"
        });
      }
      
      res.status(500).json({ 
        error: "Failed to export template",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get BOQ details for a specific quote
  app.get("/api/quotes/:quoteId/boq", requireAuth, async (req, res) => {
    try {
      const { quoteId } = req.params;

      // Validate quoteId
      if (!quoteId || typeof quoteId !== 'string') {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      // Get BOQ items for the quote
      const boqItems = await storage.getBOQByProjectVendor(quoteId);
      
      // Get quote details
      const quote = await storage.getProjectVendor(quoteId);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json({
        quote,
        boqItems
      });

    } catch (error) {
      console.error('Error fetching BOQ details:', error);
      res.status(500).json({ error: "Failed to fetch BOQ details" });
    }
  });

  // Floor Plans Routes (protected)
  app.get("/api/floor-plans", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method for consistent access control
      const floorPlans = await storage.getFloorPlansForUser(userId, userRole.role);
      res.json(floorPlans);
    } catch (error) {
      console.error('Error fetching floor plans:', error);
      res.status(500).json({ error: "Failed to fetch floor plans" });
    }
  });

  app.get("/api/floor-plans/project/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const { projectId } = req.params;
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method with project ID filter
      const floorPlans = await storage.getFloorPlansForUser(userId, userRole.role, projectId);
      res.json(floorPlans);
    } catch (error) {
      console.error('Error fetching floor plans for project:', error);
      res.status(500).json({ error: "Failed to fetch floor plans for project" });
    }
  });

  app.get("/api/floor-plans/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const { id } = req.params;
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Get user's accessible floor plans and check if this one is included
      const userFloorPlans = await storage.getFloorPlansForUser(userId, userRole.role);
      const floorPlan = userFloorPlans.find(fp => fp.id === id);
      
      if (!floorPlan) {
        return res.status(404).json({ error: "Floor plan not found or access denied" });
      }
      
      res.json(floorPlan);
    } catch (error) {
      console.error('Error fetching floor plan:', error);
      res.status(500).json({ error: "Failed to fetch floor plan" });
    }
  });

  // Configure multer for floor plan uploads with additional file types (using memoryStorage for object storage)
  const floorPlanUpload = multer({
    storage: multer.memoryStorage(), // Store in memory, then upload to object storage
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for floor plan files
      files: 1, // Only allow single file upload
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf', // .pdf
        'image/png', // .png
        'image/jpeg', // .jpg, .jpeg
        'image/gif', // .gif
        'image/bmp', // .bmp
        'image/tiff', // .tiff
        'application/dwg', // .dwg (CAD files)
        'application/dxf', // .dxf (CAD files)
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      ];
      
      // Also check file extension as MIME types can be unreliable
      const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.dwg', '.dxf', '.xlsx'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only image files (PNG, JPG, GIF, BMP, TIFF), CAD files (DWG, DXF), PDF, and Excel files are allowed.'));
      }
    }
  });

  app.post("/api/floor-plans", requireAdmin, floorPlanUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate the request body
      const { projectId, name, description, version } = req.body;
      
      if (!projectId || !name) {
        return res.status(400).json({ error: "Project ID and name are required" });
      }

      // Upload file to object storage
      const userId = (req.user as any).claims.sub;
      const objectPath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      );

      const floorPlanData = {
        projectId,
        name,
        description: description || null,
        fileName: req.file.originalname,
        filePath: objectPath, // Save object storage path instead of local path
        fileType: path.extname(req.file.originalname).toLowerCase().substring(1), // Remove dot
        fileSize: req.file.size.toString(), // Convert number to string for decimal schema
        version: version || "1.0",
        isActive: true
      };

      // Validate with Zod schema
      const validatedData = insertFloorPlanSchema.parse(floorPlanData);
      
      const floorPlan = await storage.createFloorPlan(validatedData);
      res.status(201).json(floorPlan);
    } catch (error) {
      console.error('Error creating floor plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid floor plan data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create floor plan" });
    }
  });

  app.put("/api/floor-plans/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate the request body
      const updates = insertFloorPlanSchema.partial().parse(req.body);
      
      const updatedFloorPlan = await storage.updateFloorPlan(id, updates);
      if (!updatedFloorPlan) {
        return res.status(404).json({ error: "Floor plan not found" });
      }
      
      res.json(updatedFloorPlan);
    } catch (error) {
      console.error('Error updating floor plan:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid floor plan data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update floor plan" });
    }
  });

  app.delete("/api/floor-plans/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the floor plan first to delete the file
      const floorPlan = await storage.getFloorPlan(id);
      if (!floorPlan) {
        return res.status(404).json({ error: "Floor plan not found" });
      }
      
      const deleted = await storage.deleteFloorPlan(id);
      if (!deleted) {
        return res.status(404).json({ error: "Floor plan not found" });
      }
      
      // Delete the physical file
      try {
        if (fs.existsSync(floorPlan.filePath)) {
          fs.unlinkSync(floorPlan.filePath);
        }
      } catch (fileError) {
        console.warn('Warning: Could not delete physical file:', fileError);
        // Don't fail the request if file deletion fails
      }
      
      res.json({ message: "Floor plan deleted successfully" });
    } catch (error) {
      console.error('Error deleting floor plan:', error);
      res.status(500).json({ error: "Failed to delete floor plan" });
    }
  });

  // ==================== MOODBOARDS ROUTES ====================

  // Get all moodboards (with optional project and assetType filters)
  app.get("/api/moodboards", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const { projectId, assetType } = req.query;
      const validAssetType = typeof assetType === 'string' ? assetType : undefined;
      const validProjectId = typeof projectId === 'string' ? projectId : undefined;
      
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }
      
      // Use role-based helper method for consistent access control
      const moodboards = await storage.getMoodboardsForUser(userId, userRole.role, validProjectId, validAssetType);
      res.json(moodboards);
    } catch (error) {
      console.error('Error fetching moodboards:', error);
      res.status(500).json({ error: "Failed to fetch moodboards" });
    }
  });

  // Get single moodboard
  app.get("/api/moodboards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const moodboard = await storage.getMoodboard(id);
      if (!moodboard) {
        return res.status(404).json({ error: "Moodboard not found" });
      }
      res.json(moodboard);
    } catch (error) {
      console.error('Error fetching moodboard:', error);
      res.status(500).json({ error: "Failed to fetch moodboard" });
    }
  });

  // Upload new moodboard
  app.post("/api/moodboards", requireAuth, uploadMoodboard.single('moodboard'), async (req, res) => {
    try {
      const { description, tags, projectId, canvaLink, linkOnly, assetType } = req.body;
      
      // Check if this is a Canva link-only upload (no file)
      const isLinkOnly = linkOnly === 'true';
      
      if (!req.file && !isLinkOnly) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      if (isLinkOnly && !canvaLink) {
        return res.status(400).json({ error: "Canva link is required for link-only uploads" });
      }
      
      // Parse tags if provided
      let parsedTags = null;
      if (tags && typeof tags === 'string') {
        try {
          parsedTags = tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
          if (parsedTags.length === 0) parsedTags = null;
        } catch (error) {
          console.warn('Error parsing tags:', error);
          parsedTags = null;
        }
      }

      // Validate projectId if provided
      let validatedProjectId = null;
      if (projectId && typeof projectId === 'string' && projectId !== 'general') {
        // Check if project exists
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(400).json({ error: "Project not found" });
        }
        validatedProjectId = projectId;
      }

      // Upload file to object storage if not link-only
      let objectPath = null;
      if (!isLinkOnly && req.file) {
        const userId = (req.user as any).claims.sub;
        objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype
        );
      }

      const moodboardData = isLinkOnly ? {
        projectId: validatedProjectId,
        assetType: assetType || 'moodboard',
        name: `Canva Design - ${new Date().toLocaleDateString()}`,
        description: description || null,
        fileName: null,
        filePath: null,
        fileType: null,
        fileSize: null,
        tags: parsedTags,
        canvaLink: canvaLink.trim()
      } : {
        projectId: validatedProjectId,
        assetType: assetType || 'moodboard',
        name: req.file!.originalname,
        description: description || null,
        fileName: req.file!.originalname,
        filePath: objectPath, // Save object storage path instead of local path
        fileType: path.extname(req.file!.originalname).toLowerCase().substring(1), // Remove dot
        fileSize: req.file!.size.toString(), // Convert number to string for decimal schema
        tags: parsedTags,
        canvaLink: canvaLink && typeof canvaLink === 'string' ? canvaLink.trim() : null
      };

      // Validate with Zod schema
      const validatedData = insertMoodboardSchema.parse(moodboardData);
      
      const moodboard = await storage.createMoodboard(validatedData);
      res.status(201).json(moodboard);
    } catch (error) {
      console.error('Error creating moodboard:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid moodboard data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create moodboard" });
    }
  });

  // Update moodboard metadata (not the file)
  app.put("/api/moodboards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Allow updating only name, description, tags, and canvaLink
      const { name, description, tags, canvaLink } = req.body;
      const updates: any = {};
      
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (tags !== undefined) {
        if (Array.isArray(tags)) {
          updates.tags = tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
        } else {
          updates.tags = null;
        }
      }
      if (canvaLink !== undefined) {
        updates.canvaLink = canvaLink && typeof canvaLink === 'string' ? canvaLink.trim() : null;
      }
      
      const updatedMoodboard = await storage.updateMoodboard(id, updates);
      if (!updatedMoodboard) {
        return res.status(404).json({ error: "Moodboard not found" });
      }
      
      res.json(updatedMoodboard);
    } catch (error) {
      console.error('Error updating moodboard:', error);
      res.status(500).json({ error: "Failed to update moodboard" });
    }
  });

  // Delete moodboard
  app.delete("/api/moodboards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the moodboard first to delete the file
      const moodboard = await storage.getMoodboard(id);
      if (!moodboard) {
        return res.status(404).json({ error: "Moodboard not found" });
      }
      
      const deleted = await storage.deleteMoodboard(id);
      if (!deleted) {
        return res.status(404).json({ error: "Moodboard not found" });
      }
      
      // Delete the physical file
      try {
        if (fs.existsSync(moodboard.filePath)) {
          fs.unlinkSync(moodboard.filePath);
        }
      } catch (fileError) {
        console.warn('Warning: Could not delete physical file:', fileError);
        // Don't fail the request if file deletion fails
      }
      
      res.json({ message: "Moodboard deleted successfully" });
    } catch (error) {
      console.error('Error deleting moodboard:', error);
      res.status(500).json({ error: "Failed to delete moodboard" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
