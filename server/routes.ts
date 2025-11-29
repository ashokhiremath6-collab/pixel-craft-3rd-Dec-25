import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, db } from "./db";
import multer from "multer";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import pdfParse from "pdf-parse";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError, parseObjectPath, signObjectURL } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { 
  insertVendorCategorySchema,
  insertVendorSchema,
  insertVendorContactSchema,
  insertProjectSchema,
  insertProjectVendorSchema,
  insertQuoteTemplateSchema,
  insertBoqSchema,
  insertQuoteFileSchema,
  insertFloorPlanSchema,
  insertMoodboardSchema,
  insertUserRoleSchema,
  insertUserProjectAssignmentSchema,
  insertTaskSchema,
  insertTaskDependencySchema,
  insertTaskAlertSchema,
  insertApprovalSchema,
  insertVendorInvoiceSchema,
  insertVendorPaymentSchema,
  insertCatalogueItemSchema,
  insertWorksOrderTemplateSchema,
  insertWorksOrderSchema,
  insertWorksOrderSignatureSchema,
  worksOrderFiles
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
  console.log("🔐 requireAuth called for:", req.path);
  console.log("🔑 isAuthenticated:", req.isAuthenticated());
  console.log("👤 has user:", !!req.user);
  
  if (!req.isAuthenticated() || !req.user) {
    console.log("❌ Auth failed - returning 401");
    return res.status(401).json({ error: "Authentication required" });
  }
  console.log("✅ Auth passed - calling next()");
  next();
};

// Middleware for designer or admin access (content management)
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

// Middleware for admin-only access (user management, security-critical operations)
const requireAdminOnly = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  try {
    const userId = (req.user as any).claims.sub;
    const userRole = await storage.getUserRole(userId);
    if (!userRole || userRole.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
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
    console.log("📥 OBJECT DOWNLOAD REQUEST:", req.path);
    const userId = (req.user as any).claims.sub;
    console.log("👤 User ID:", userId);
    
    try {
      const objectStorageService = new ObjectStorageService();
      console.log("🔍 Getting object entity file...");
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      console.log("✅ Object file retrieved successfully");
      
      console.log("🔐 Checking access permissions...");
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      console.log("🔑 Access check result:", canAccess);
      
      if (!canAccess) {
        console.log("❌ Access denied - returning 403");
        return res.status(403).send("Access denied: You don't have permission to view this file");
      }
      
      console.log("📤 Starting download...");
      objectStorageService.downloadObject(objectFile, res);
      console.log("✅ Download initiated successfully");
    } catch (error) {
      console.error("❌ ERROR accessing object:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: error?.constructor?.name
      });
      if (error instanceof ObjectNotFoundError) {
        console.log("🔍 Error type: ObjectNotFoundError - returning 404");
        return res.status(404).send("File not found: This file may have been deleted or moved");
      }
      // Check for configuration errors
      if (error instanceof Error && error.message.includes('PRIVATE_OBJECT_DIR')) {
        console.log("⚙️ Configuration error - returning 503");
        return res.status(503).send("Service temporarily unavailable: Object storage configuration error");
      }
      console.log("💥 Unknown error type - returning 500");
      return res.status(500).send("Internal server error: Failed to retrieve file");
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
      if (!filename || filename.includes('..') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      // First, try to find the file in the database to get the actual path
      const allProjectVendors = await storage.getAllProjectVendors();
      const projectVendor = allProjectVendors.find(pv => 
        pv.quotationFile && pv.quotationFile.includes(filename)
      );
      
      const allQuoteFiles = await storage.getAllQuoteFiles();
      const quoteFile = allQuoteFiles.find(qf => 
        qf.filePath && qf.filePath.includes(filename)
      );
      
      const actualPath = projectVendor?.quotationFile || quoteFile?.filePath;
      
      // If we found a database record with an object storage path, serve from object storage
      if (actualPath && actualPath.startsWith('/objects/')) {
        const objectStorageService = new ObjectStorageService();
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(actualPath);
          const userId = (req.user as any).claims.sub;
          const canAccess = await objectStorageService.canAccessObjectEntity({
            objectFile,
            userId: userId,
            requestedPermission: ObjectPermission.READ,
          });
          if (canAccess) {
            return await objectStorageService.downloadObject(objectFile, res);
          } else {
            return res.status(403).json({ error: 'Access denied' });
          }
        } catch (error) {
          console.error('Error accessing object storage:', error);
          if (error instanceof ObjectNotFoundError) {
            return res.status(404).json({ error: 'File not found in object storage' });
          }
          throw error;
        }
      }
      
      // Fall back to local filesystem for legacy files
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
          
          // If no role found, treat as 'client' (users without designer/admin role)
          const role = userRole?.role || 'client';
          
          if (role === 'designer' || role === 'admin') {
            // Designer or admin can access all files
          } else if (role === 'client') {
            // Check if client has access to this project (role-based access)
            const accessibleProjects = await storage.getProjectsForUser(userId, role);
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
      if (!filename || filename.includes('..') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      // Look up the actual file path from the database
      const allFloorPlans = await storage.getAllFloorPlans();
      const floorPlan = allFloorPlans.find(fp => 
        fp.filePath && fp.filePath.includes(filename)
      );
      
      const actualPath = floorPlan?.filePath;
      
      // If we found a database record with an object storage path, serve from object storage
      if (actualPath && actualPath.startsWith('/objects/')) {
        const objectStorageService = new ObjectStorageService();
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(actualPath);
          const userId = (req.user as any).claims.sub;
          const canAccess = await objectStorageService.canAccessObjectEntity({
            objectFile,
            userId: userId,
            requestedPermission: ObjectPermission.READ,
          });
          if (canAccess) {
            return await objectStorageService.downloadObject(objectFile, res);
          } else {
            return res.status(403).json({ error: 'Access denied' });
          }
        } catch (error) {
          console.error('Error accessing object storage:', error);
          if (error instanceof ObjectNotFoundError) {
            return res.status(404).json({ error: 'Floor plan not found in object storage' });
          }
          throw error;
        }
      }
      
      // Fall back to local filesystem for legacy files
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
          
          // If no role found, treat as 'client' (users without designer/admin role)
          const role = userRole?.role || 'client';
          
          if (role === 'designer' || role === 'admin') {
            // Designer or admin can access all files
          } else if (role === 'client') {
            // Check if client has access to this project
            const accessibleProjects = await storage.getProjectsForUser(userId, role);
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
      if (!filename || filename.includes('..') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      // Look up the actual file path from the database
      const allMoodboards = await storage.getAllMoodboards();
      const moodboard = allMoodboards.find(mb => 
        mb.filePath && mb.filePath.includes(filename)
      );
      
      const actualPath = moodboard?.filePath;
      
      // If we found a database record with an object storage path, serve from object storage
      if (actualPath && actualPath.startsWith('/objects/')) {
        const objectStorageService = new ObjectStorageService();
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(actualPath);
          const userId = (req.user as any).claims.sub;
          const canAccess = await objectStorageService.canAccessObjectEntity({
            objectFile,
            userId: userId,
            requestedPermission: ObjectPermission.READ,
          });
          if (canAccess) {
            return await objectStorageService.downloadObject(objectFile, res);
          } else {
            return res.status(403).json({ error: 'Access denied' });
          }
        } catch (error) {
          console.error('Error accessing object storage:', error);
          if (error instanceof ObjectNotFoundError) {
            return res.status(404).json({ error: 'Moodboard not found in object storage' });
          }
          throw error;
        }
      }
      
      // Fall back to local filesystem for legacy files
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
  app.post("/api/auth/role", requireAdminOnly, async (req, res) => {
    try {
      const { userId, role } = req.body;
      
      if (!userId || !role) {
        return res.status(400).json({ error: "User ID and role are required" });
      }
      
      if (!['client', 'designer', 'project_manager', 'admin'].includes(role)) {
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
  app.get("/api/users", requireAdminOnly, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Fetch roles for all users
      const usersWithRoles = await Promise.all(
        users.map(async (user) => {
          const role = await storage.getUserRole(user.id);
          return {
            ...user,
            role: role?.role || null,
            roleIsActive: role?.isActive || false,
          };
        })
      );
      
      res.json(usersWithRoles);
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
  
  // User Project Assignments routes (admin only) - for project_manager role
  app.get("/api/user-project-assignments/:userId", requireAdminOnly, async (req, res) => {
    try {
      const { userId } = req.params;
      const assignments = await storage.getUserProjectAssignments(userId);
      res.json(assignments);
    } catch (error) {
      console.error('Get user project assignments error:', error);
      res.status(500).json({ error: "Failed to fetch user project assignments" });
    }
  });
  
  app.post("/api/user-project-assignments", requireAdminOnly, async (req, res) => {
    try {
      // Validate request body with Zod
      const assignmentSchema = insertUserProjectAssignmentSchema.pick({ userId: true, projectId: true });
      const parseResult = assignmentSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: parseResult.error.errors 
        });
      }
      
      const { userId, projectId } = parseResult.data;
      const currentUserId = (req.user as any).claims.sub;
      
      const assignment = await storage.assignUserToProject({
        userId,
        projectId,
        assignedBy: currentUserId
      });
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Assign user to project error:', error);
      res.status(500).json({ error: "Failed to assign user to project" });
    }
  });
  
  app.delete("/api/user-project-assignments/:userId/:projectId", requireAdminOnly, async (req, res) => {
    try {
      const { userId, projectId } = req.params;
      
      // Validate params
      const paramSchema = z.object({
        userId: z.string().min(1, "userId is required"),
        projectId: z.string().uuid("projectId must be a valid UUID")
      });
      
      const parseResult = paramSchema.safeParse({ userId, projectId });
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid parameters", 
          details: parseResult.error.errors 
        });
      }
      
      const deleted = await storage.removeUserFromProject(userId, projectId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Project assignment not found" });
      }
      
      res.json({ message: "Project assignment removed successfully" });
    } catch (error) {
      console.error('Remove user from project error:', error);
      res.status(500).json({ error: "Failed to remove project assignment" });
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method for consistent access control
      const vendors = await storage.getVendorsForUser(userId, role);
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors-with-projects", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method to get filtered vendors
      const vendors = await storage.getVendorsForUser(userId, role);
      const projectVendors = await storage.getProjectVendorsForUser(userId, role);
      
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
      console.log('📥 Received vendor data:', JSON.stringify(req.body, null, 2));
      console.log('📧 Email field - type:', typeof req.body.email, 'value:', JSON.stringify(req.body.email));
      
      const { additionalContacts, ...vendorData } = req.body;
      const parsed = insertVendorSchema.parse(vendorData);
      console.log('✅ Validation passed. Email after validation:', parsed.email);
      
      const vendor = await storage.createVendor(parsed);
      
      // Create additional contacts if provided
      if (additionalContacts && Array.isArray(additionalContacts) && additionalContacts.length > 0) {
        for (const contact of additionalContacts) {
          if (contact.contactPerson && contact.phone) {
            await storage.createVendorContact({
              vendorId: vendor.id,
              contactPerson: contact.contactPerson,
              phone: contact.phone,
              email: contact.email || null,
              role: contact.role || null,
              isPrimary: false,
            });
          }
        }
      }
      
      // Log activity
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email,
          activityType: 'vendor_create',
          fileName: vendor.name,
          description: `created vendor "${vendor.name}"`,
          metadata: { vendorId: vendor.id }
        });
      }
      
      res.status(201).json(vendor);
    } catch (error) {
      console.error("❌ Error creating vendor:", error);
      if (error instanceof z.ZodError) {
        console.error("❌ Zod validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Invalid vendor data", details: error.errors });
      }
      if (error instanceof Error && error.message.includes("already exists")) {
        return res.status(400).json({ error: error.message });
      }
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
      
      // Log activity
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email,
          activityType: 'vendor_update',
          fileName: vendor.name,
          description: `updated vendor "${vendor.name}"`,
          metadata: { vendorId: vendor.id }
        });
      }
      
      res.json(vendor);
    } catch (error) {
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });

  app.patch("/api/vendors/:id", requireAdmin, async (req, res) => {
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
      // Get vendor details before deleting for activity log
      const vendor = await storage.getVendor(req.params.id);
      
      const deleted = await storage.deleteVendor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      
      // Log activity
      if (vendor) {
        const userId = (req.user as any).claims.sub;
        const user = await storage.getUser(userId);
        if (user) {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email,
            activityType: 'vendor_delete',
            fileName: vendor.name,
            description: `deleted vendor "${vendor.name}"`,
            metadata: { vendorId: req.params.id }
          });
        }
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

  // Vendor Contacts Routes
  app.get("/api/vendors/:vendorId/contacts", requireAuth, async (req, res) => {
    try {
      const contacts = await storage.getVendorContacts(req.params.vendorId);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching vendor contacts:', error);
      res.status(500).json({ error: "Failed to fetch vendor contacts" });
    }
  });

  app.post("/api/vendors/:vendorId/contacts", requireAdmin, async (req, res) => {
    try {
      const parsed = insertVendorContactSchema.parse({
        ...req.body,
        vendorId: req.params.vendorId
      });
      const contact = await storage.createVendorContact(parsed);
      res.json(contact);
    } catch (error) {
      console.error('Error creating vendor contact:', error);
      res.status(400).json({ error: "Invalid contact data" });
    }
  });

  app.patch("/api/vendors/:vendorId/contacts/:contactId", requireAdmin, async (req, res) => {
    try {
      const parsed = insertVendorContactSchema.partial().parse(req.body);
      const contact = await storage.updateVendorContact(req.params.contactId, parsed);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error('Error updating vendor contact:', error);
      res.status(400).json({ error: "Invalid contact data" });
    }
  });

  app.delete("/api/vendors/:vendorId/contacts/:contactId", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteVendorContact(req.params.contactId);
      if (!deleted) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting vendor contact:', error);
      res.status(500).json({ error: "Failed to delete vendor contact" });
    }
  });

  // Projects Routes (protected)
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method for consistent access control
      const projects = await storage.getProjectsForUser(userId, role);
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Get user's accessible projects and check if this project is included
      const userProjects = await storage.getProjectsForUser(userId, role);
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

  app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      
      // Parse the update data
      const parsed = insertProjectSchema.partial().parse(req.body);
      
      // Check if user is admin/designer
      if (role === 'admin' || role === 'designer') {
        // Admin/designer can update any field
        const project = await storage.updateProject(req.params.id, parsed);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        return res.json(project);
      }
      
      // For clients, verify they have access to the project
      const userProjects = await storage.getProjectsForUser(userId, role);
      const hasAccess = userProjects.some(p => p.id === req.params.id);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Clients can only update ganttChartLink
      const allowedFields = ['ganttChartLink'];
      const updateData: any = {};
      
      for (const key of Object.keys(parsed)) {
        if (allowedFields.includes(key)) {
          updateData[key] = parsed[key as keyof typeof parsed];
        }
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(403).json({ error: "Clients can only update Gantt chart link" });
      }
      
      const project = await storage.updateProject(req.params.id, updateData);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error('Update project error:', error);
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  // PATCH route for updating specific project fields (like ganttChartLink)
  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      
      // Parse the update data
      const parsed = insertProjectSchema.partial().parse(req.body);
      
      // Check if user is admin/designer
      if (role === 'admin' || role === 'designer') {
        // Admin/designer can update any field
        const project = await storage.updateProject(req.params.id, parsed);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        return res.json(project);
      }
      
      // For clients, verify they have access to the project
      const userProjects = await storage.getProjectsForUser(userId, role);
      const hasAccess = userProjects.some(p => p.id === req.params.id);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Clients can only update ganttChartLink
      const allowedFields = ['ganttChartLink'];
      const updateData: any = {};
      
      for (const key of Object.keys(parsed)) {
        if (allowedFields.includes(key)) {
          updateData[key] = parsed[key as keyof typeof parsed];
        }
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(403).json({ error: "Clients can only update Gantt chart link" });
      }
      
      const project = await storage.updateProject(req.params.id, updateData);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error('Update project error:', error);
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

  app.get("/api/projects/:id/categories-with-quotes", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      
      const userProjects = await storage.getProjectsForUser(userId, role);
      const hasAccess = userProjects.some(p => p.id === req.params.id);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const categories = await storage.getProjectCategoriesWithQuotes(req.params.id);
      res.json(categories);
    } catch (error) {
      console.error('Get project categories with quotes error:', error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/projects/:id/quotes", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      
      const userProjects = await storage.getProjectsForUser(userId, role);
      const hasAccess = userProjects.some(p => p.id === req.params.id);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const category = req.query.category as string;
      if (!category) {
        return res.status(400).json({ error: "Category parameter is required" });
      }
      
      const quotes = await storage.getProjectQuotesByCategory(req.params.id, category);
      res.json(quotes);
    } catch (error) {
      console.error('Get project quotes by category error:', error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  // Project Clients Routes (Admin/Designer only)
  app.get("/api/projects/:projectId/clients", requireAdmin, async (req, res) => {
    try {
      const clients = await storage.getProjectClients(req.params.projectId);
      res.json(clients);
    } catch (error) {
      console.error('Get project clients error:', error);
      res.status(500).json({ error: "Failed to fetch project clients" });
    }
  });

  app.post("/api/projects/:projectId/clients", requireAdmin, async (req, res) => {
    try {
      const { insertProjectClientSchema } = await import("@shared/schema");
      const parsed = insertProjectClientSchema.parse({
        ...req.body,
        projectId: req.params.projectId
      });
      const client = await storage.addProjectClient(parsed);
      res.status(201).json(client);
    } catch (error: any) {
      console.error('Add project client error:', error);
      res.status(400).json({ error: error.message || "Invalid client data" });
    }
  });

  app.delete("/api/project-clients/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.removeProjectClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project client not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove project client" });
    }
  });

  // Project Vendors Routes
  app.get("/api/project-vendors", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method for consistent access control
      const projectVendors = await storage.getProjectVendorsForUser(userId, role);
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method with project ID filter
      const projectVendors = await storage.getProjectVendorsForUser(userId, role, projectId);
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
      const userId = (req.user as any).claims.sub;
      const { id } = req.params;
      
      // Get the project vendor before deletion for logging
      const projectVendor = await storage.getProjectVendor(id);
      if (!projectVendor) {
        return res.status(404).json({ error: "Project vendor not found" });
      }
      
      const success = await storage.deleteProjectVendor(id);
      if (success) {
        // Log deletion activity
        const user = await storage.getUser(userId);
        if (user) {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            projectId: projectVendor.projectId,
            activityType: 'quote_file_delete' as any,
            fileName: projectVendor.quotationName || 'Quote',
            description: `deleted quotation "${projectVendor.quotationName}"`,
            timestamp: new Date(),
            metadata: {
              projectVendorId: id,
              vendorId: projectVendor.vendorId,
            },
          });
        }
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const userRole = userRoleData?.role || 'client';
      
      // Get all project vendors
      const projectVendors = await storage.getAllProjectVendors();
      
      // Get all projects and vendors for joining
      const allProjects = await storage.getAllProjects();
      const vendors = await storage.getAllVendors();
      const categories = await storage.getAllVendorCategories();
      
      // Get all activities for uploader information (optimization: fetch once for all quotes)
      const allActivities = await storage.getRecentActivities(500);
      
      // Filter projects based on user role and access
      let projects = allProjects;
      if (userRole === 'client') {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }
        // Get projects from both old clientEmail field and new projectClients table
        const clientEmailProjects = allProjects.filter(project => project.clientEmail === user.email);
        const projectClientProjects = await storage.getProjectsByClientEmail(user.email);
        
        // Combine and deduplicate
        const projectIds = new Set([
          ...clientEmailProjects.map(p => p.id),
          ...projectClientProjects.map(p => p.id)
        ]);
        projects = allProjects.filter(p => projectIds.has(p.id));
      }
      
      // Create lookup maps for performance
      const projectMap = new Map(projects.map(p => [p.id, p]));
      const vendorMap = new Map(vendors.map(v => [v.id, v]));
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      
      // Transform project vendors into quotation format grouped by project
      const quotationsByProject: Record<string, any[]> = {};
      
      // Calculate totals from BOQ items for quotes without explicit totals
      for (const pv of projectVendors) {
        const project = projectMap.get(pv.projectId);
        
        // For comparative statements, vendor is null and category comes from pv.category
        // For regular quotes, vendor should exist and category comes from vendor
        const isComparativeStatement = pv.unitRateSubtype === 'comparative';
        const vendor = pv.vendorId ? vendorMap.get(pv.vendorId) : null;
        const categoryFromVendor = vendor ? categoryMap.get(vendor.categoryId) : null;
        const categoryName = isComparativeStatement ? pv.category : categoryFromVendor?.name;
        
        // Only include project vendors for projects the user has access to
        // For comparative statements: project and categoryName must exist
        // For regular quotes: project, vendor, and category must exist
        const isValid = project && projects.some(p => p.id === project.id) &&
          (isComparativeStatement ? !!categoryName : !!(vendor && categoryFromVendor));
        
        if (isValid) {
          if (!quotationsByProject[pv.projectId]) {
            quotationsByProject[pv.projectId] = [];
          }
          
          let quotationValue = pv.quotationValue;
          
          // If no explicit quotation value or it's zero/null, calculate from BOQ items
          const numericValue = quotationValue ? parseFloat(quotationValue) : 0;
          if (!quotationValue || numericValue === 0 || isNaN(numericValue)) {
            try {
              const boqItems = await storage.getBOQByProjectVendor(pv.id);
              if (boqItems && boqItems.length > 0) {
                const calculatedTotal = boqItems.reduce((sum, item) => {
                  const itemTotal = parseFloat(item.totalAmount || '0');
                  return sum + itemTotal;
                }, 0);
                if (calculatedTotal > 0) {
                  quotationValue = calculatedTotal.toString();
                  console.log(`Calculated total for quote ${pv.quotationName}: ₹${calculatedTotal}`);
                }
              } else {
                console.log(`No BOQ items found for quote ${pv.quotationName} (${pv.id})`);
              }
            } catch (error) {
              console.error(`Error calculating BOQ total for quote ${pv.id}:`, error);
            }
          }
          
          // Get uploader info and upload timestamp from activity log (using pre-fetched activities)
          let uploaderName = null;
          let uploadedAt = null;
          const uploadActivity = allActivities.find(
            a => a.activityType === 'quote_upload' && 
            a.metadata && 
            typeof a.metadata === 'object' && 
            'projectVendorId' in a.metadata && 
            a.metadata.projectVendorId === pv.id
          );
          if (uploadActivity) {
            uploaderName = uploadActivity.userName;
            uploadedAt = uploadActivity.createdAt;
          }

          quotationsByProject[pv.projectId].push({
            id: pv.id,
            vendorName: isComparativeStatement ? 'Multiple Vendors' : (vendor?.name || 'Unknown'),
            category: categoryName || 'Uncategorized',
            quotationName: pv.quotationName,
            quotationType: pv.quotationType,
            quotationValue: quotationValue,
            dateOfQuotation: pv.dateOfQuotation,
            status: pv.status,
            quotationFile: pv.quotationFile,
            notes: pv.notes,
            isNegotiated: pv.isNegotiated,
            projectId: pv.projectId,
            projectName: project.projectName,
            uploaderName: uploaderName,
            uploadedAt: uploadedAt,
            unitRateSubtype: pv.unitRateSubtype
          });
        }
      }
      
      res.json({
        projects: projects,
        quotations: quotationsByProject
      });
    } catch (error) {
      console.error('Error fetching quotations:', error);
      res.status(500).json({ error: "Failed to fetch quotations" });
    }
  });

  // Export Project Cost Breakdown as Excel
  app.post("/api/quotations/export-cost-breakdown", requireAuth, async (req, res) => {
    try {
      const { quotations } = req.body;
      
      if (!quotations || !Array.isArray(quotations)) {
        return res.status(400).json({ error: "Invalid quotations data" });
      }

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PixelCraft Designer';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Project Cost Breakdown');

      // Define columns
      worksheet.columns = [
        { header: 'Vendor', key: 'vendor', width: 30 },
        { header: 'Project', key: 'project', width: 20 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Rs lacs', key: 'value', width: 12 }
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 20;

      // Add data rows
      let totalValue = 0;
      quotations.forEach((q: any) => {
        const valueInLacs = parseFloat(q.quotationValue || '0') / 100000;
        totalValue += valueInLacs;
        
        const row = worksheet.addRow({
          vendor: q.vendorName,
          project: q.projectName,
          category: q.category || '-',
          value: valueInLacs
        });
        
        // Right-align the value column
        row.getCell('value').alignment = { horizontal: 'right' };
        row.getCell('value').numFmt = '0.00';
      });

      // Add empty row before total
      worksheet.addRow({});

      // Add total row
      const totalRow = worksheet.addRow({
        vendor: '',
        project: '',
        category: 'TOTAL',
        value: totalValue
      });
      totalRow.font = { bold: true, size: 12 };
      totalRow.getCell('category').alignment = { horizontal: 'right' };
      totalRow.getCell('value').alignment = { horizontal: 'right' };
      totalRow.getCell('value').numFmt = '0.00';
      totalRow.getCell('value').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF2CC' }
      };

      // Add borders to all data cells
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 0 && rowNumber <= quotations.length + 1) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
            };
          });
        }
      });

      // Generate Excel buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Set headers for download
      const filename = `Project_Cost_Breakdown_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);

      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error exporting project cost breakdown:', error);
      res.status(500).json({ error: "Failed to export project cost breakdown" });
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

  app.put("/api/quote-templates/:id", requireAdmin, async (req, res) => {
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

  app.delete("/api/quote-templates/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteQuoteTemplate(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({ error: "Failed to delete template" });
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
    
    // First check if this is a unit rates / price list document (no total)
    const fullText = pdfText.toLowerCase();
    const isUnitRates = /\b(unit\s*rate|rate\s*card|price\s*list|rate\s*sheet|unit\s*price|item\s*rate)\b/i.test(fullText);
    
    if (isUnitRates) {
      console.log('PDF Detection: Unit rates document detected - no total will be extracted');
      detectedTotals.isUnitRates = true;
      detectedTotals.grandTotal = -1; // Special marker for unit rates
    } else {
      // Smart total detection with multiple strategies
      const totalCandidates: number[] = [];
      const MAX_REASONABLE_QUOTE = 20000000; // 2 crore max (reasonable upper limit)
      
      // Strategy 1: Look for explicit total patterns (highest priority)
      let checkedLines = 0;
      for (const line of lines) {
        checkedLines++;
        
        // Check for "Amount Chargeable in Words" (if present, most reliable)
        if (line.toLowerCase().includes('amount') && line.toLowerCase().includes('chargeable')) {
          console.log(`PDF Total Detection: Found "Amount Chargeable" line: "${line.substring(0, 100)}..."`);
          const textAfter = line.substring(line.toLowerCase().indexOf('chargeable'));
          const numMatches = textAfter.match(/([0-9,]+(?:\.[0-9]{2})?)/g);
          if (numMatches && numMatches.length > 0) {
            const lastNum = parseCurrency(numMatches[numMatches.length - 1]);
            console.log(`PDF Total Detection: Extracted number ${lastNum} from Amount Chargeable line`);
            if (lastNum > 100 && lastNum <= MAX_REASONABLE_QUOTE) {
              totalCandidates.push(lastNum);
              console.log(`PDF Total Detection: ✓ Accepted total from "Amount Chargeable": ${lastNum}`);
            }
          }
        }
        
        // Check for standard total patterns (Grand Total, Net Total, etc.)
        const totalMatch = line.match(patterns.grandTotal);
        if (totalMatch && totalMatch[2]) {
          const num = parseCurrency(totalMatch[2]);
          if (num > 100 && num <= MAX_REASONABLE_QUOTE) {
            totalCandidates.push(num);
            console.log(`PDF Total Detection: ✓ Found labeled total: ${num} in line: "${line.substring(0, 100)}..."`);
          }
        }
        
        // Check for "Lakhs/Lacs" format totals (common in Indian invoices)
        if (line.toLowerCase().match(/(lakhs?|lacs?)/)) {
          console.log(`PDF Total Detection: Found "lakhs/lacs" in line: "${line.substring(0, 100)}..."`);
          const lakhsMatch = line.match(/(total|amount|value)[\s:]*([0-9,]+(?:\.[0-9]{2})?)\s*(lakhs?|lacs?)/gi);
          if (lakhsMatch) {
            const numStr = line.match(/([0-9,]+(?:\.[0-9]{2})?)\s*(lakhs?|lacs?)/i);
            if (numStr && numStr[1]) {
              const num = parseCurrency(numStr[1]) * 100000; // Convert lakhs to actual number
              console.log(`PDF Total Detection: Extracted ${numStr[1]} lakhs = ${num}`);
              if (num > 100 && num <= MAX_REASONABLE_QUOTE) {
                totalCandidates.push(num);
                console.log(`PDF Total Detection: ✓ Accepted lakhs total: ${num}`);
              }
            }
          }
        }
      }
      
      console.log(`PDF Total Detection: Strategy 1 checked ${checkedLines} lines, found ${totalCandidates.length} labeled totals`);
      
      // If we found labeled totals, use the highest one
      if (totalCandidates.length > 0) {
        console.log(`PDF Total Detection: Using highest labeled total: ${Math.max(...totalCandidates)}`);
      }
      
      // Strategy 2: If no labeled totals found, scan for reasonable numbers
      if (totalCandidates.length === 0) {
        const allNumbers: number[] = [];
        
        // Keywords to ignore - these indicate the number is NOT a quote total
        const ignoreKeywords = [
          'a/c', 'account', 'bank', 'ifsc', 'branch', 'swift', 'micr',
          'gstin', 'gst no', 'pan', 'tan', 'cin', 'registration',
          'phone', 'mobile', 'contact', 'tel', 'fax',
          'pincode', 'zip', 'postal code',
          'invoice no', 'bill no', 'quotation no', 'order no',
          'date', 'validity', 'reference'
        ];
        
        for (const line of lines) {
          // Skip lines containing keywords that indicate bank/company details
          const lowerLine = line.toLowerCase();
          if (ignoreKeywords.some(keyword => lowerLine.includes(keyword))) {
            console.log(`PDF Total Detection: Skipping line with keyword: "${line}"`);
            continue;
          }
          
          const numberPattern = /(?:₹|Rs\.?|\$|USD|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/g;
          const numberMatches = Array.from(line.matchAll(numberPattern));
          
          for (const match of numberMatches) {
            const num = parseCurrency(match[1]);
            const originalStr = match[1].replace(/,/g, ''); // Remove commas but keep original
            
            // Skip bank account numbers (12-18 digits, no decimal points)
            if (originalStr.length >= 12 && !originalStr.includes('.')) {
              console.log(`PDF Total Detection: Skipping bank account-like number: ${originalStr}`);
              continue;
            }
            
            // Filter: must be > 100 AND <= MAX_REASONABLE_QUOTE
            if (num > 100 && num <= MAX_REASONABLE_QUOTE) {
              allNumbers.push(num);
            }
          }
        }
        
        // Take the biggest reasonable number
        if (allNumbers.length > 0) {
          totalCandidates.push(Math.max(...allNumbers));
          console.log(`PDF Total Detection: Scanned ${allNumbers.length} numbers, biggest reasonable value is ${Math.max(...allNumbers)}`);
        }
      }
      
      // Set the detected total
      if (totalCandidates.length > 0) {
        detectedTotals.grandTotal = Math.max(...totalCandidates);
      }
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

  // Helper function to parse Excel/CSV/PDF files from buffer
  const parseQuoteFile = async (fileBuffer: Buffer, mimeType: string, fileName?: string, isUnitRate: boolean = false) => {
    try {
      if (mimeType.includes('csv')) {
        // Parse CSV file from buffer
        const csvData = fileBuffer.toString('utf8');
        const parsed = Papa.parse(csvData, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim().toLowerCase()
        });
        
        // Simpler approach: scan whole page, look at bottom rows, pick largest number
        const items = [];
        const allRows = parsed.data as any[];
        const headers = parsed.meta.fields || [];
        
        // Collect all non-empty rows
        for (const row of allRows) {
          if (Object.values(row).some(val => val !== '')) {
            items.push(row);
          }
        }
        
        // Look at the bottom 10 rows and find the largest number
        const bottomRowCount = Math.min(10, allRows.length);
        const bottomRows = allRows.slice(-bottomRowCount);
        let grandTotal = 0;
        
        for (const row of bottomRows) {
          for (const key of Object.keys(row)) {
            const value = row[key];
            let numValue = 0;
            
            if (typeof value === 'number') {
              numValue = value;
            } else if (typeof value === 'string') {
              numValue = parseFloat(value.toString().replace(/[,₹\$\s]/g, ''));
            }
            
            if (!isNaN(numValue) && numValue > 100 && numValue > grandTotal) {
              grandTotal = numValue;
            }
          }
        }
        
        // Override total for unit rate quotes
        const finalGrandTotal = isUnitRate ? -1 : (grandTotal > 0 ? grandTotal : undefined);
        
        return {
          items,
          totals: { grandTotal: finalGrandTotal },
          originalFormat: 'csv'
        };
      } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        // Parse Excel file from buffer
        const workbook = XLSX.read(fileBuffer);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, {
          header: 1, // Get as array of arrays first
          defval: ''
        });
        
        if (data.length === 0) return { items: [], totals: {}, originalFormat: 'excel' };
        
        // Convert to objects using first row as headers
        const headers = (data[0] as string[]).map(h => String(h).trim().toLowerCase());
        const rows = data.slice(1) as any[][];
        
        const items = [];
        
        // Collect all non-empty rows
        for (const row of rows) {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          
          if (Object.values(obj).some(val => val !== '')) {
            items.push(obj);
          }
        }
        
        // Look at the bottom 10 rows and find the largest number
        const bottomRowCount = Math.min(10, rows.length);
        const bottomRows = rows.slice(-bottomRowCount);
        let grandTotal = 0;
        
        for (const row of bottomRows) {
          for (let i = 0; i < row.length; i++) {
            const value = row[i];
            let numValue = 0;
            
            if (typeof value === 'number') {
              numValue = value;
            } else if (typeof value === 'string') {
              numValue = parseFloat(value.toString().replace(/[,₹\$\s]/g, ''));
            }
            
            if (!isNaN(numValue) && numValue > 100 && numValue > grandTotal) {
              grandTotal = numValue;
            }
          }
        }
        
        // Override total for unit rate quotes
        const finalGrandTotal = isUnitRate ? -1 : (grandTotal > 0 ? grandTotal : undefined);
        
        return {
          items,
          totals: { grandTotal: finalGrandTotal },
          originalFormat: 'excel'
        };
      } else if (mimeType.includes('pdf') || (fileName && fileName.toLowerCase().endsWith('.pdf'))) {
        // Parse PDF file from buffer
        const pdfData = await pdfParse(fileBuffer);
        const text = pdfData.text;
        
        // Extract quote information using pattern matching
        const result = extractQuoteDataFromPDF(text);
        
        // If this is a unit rate quote, override the total value
        if (isUnitRate) {
          console.log('Unit rate quote detected via dropdown - setting total to -1');
          result.totals.grandTotal = -1; // -1 marker for unit rates
        } else if (!result.totals.grandTotal || result.totals.grandTotal <= 0) {
          // For regular quotes, if PDF has no total, leave it undefined
          // so it will be calculated from BOQ items later
          console.log('Regular quote selected but PDF has no total - will calculate from BOQ items');
          result.totals.grandTotal = undefined;
        }
        
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
  const processQuoteImport = async (data: any, projectId: string, vendorId: string | null, importParams?: {
    quotationName?: string;
    quotationType?: string;
    itemCategory?: string;
    parentQuotationId?: string;
    unitRateSubtype?: string;
    categoryId?: string;
    categoryName?: string;
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

      // Check if this is a unit rates document (marked with -1)
      if (totals.grandTotal === -1) {
        totalValue = -1; // Keep the special marker
        useDetectedTotal = true;
        console.log(`📋 Unit rates document detected - setting totalValue to -1`);
      }
      // Use detected grand total from PDF if available
      else if (totals.grandTotal && totals.grandTotal > 0) {
        totalValue = totals.grandTotal;
        useDetectedTotal = true;
        console.log(`📋 Using detected grand total from PDF: ${totalValue}`);
      } else {
        console.log(`📋 No grand total detected in PDF. totals.grandTotal = ${totals.grandTotal}, totalValue remains ${totalValue}`);
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
      console.log(`📋 Creating project vendor with totalValue=${totalValue}, will be stored as quotationValue="${totalValue.toString()}"`);
      
      // For comparative statements (null vendorId), we need to handle them specially
      const isComparativeStatement = vendorId === null && importParams?.unitRateSubtype === 'comparative';
      
      const projectVendorData: any = {
        projectId,
        quotationValue: totalValue.toString(),
        dateOfQuotation: new Date().toISOString().split('T')[0],
        status: 'Quoted' as const,
        notes: `Imported ${boqItems.length} BOQ items`,
        quotationName: importParams?.quotationName || "Main Quote",
        quotationType: importParams?.quotationType || "item",
        itemCategory: importParams?.itemCategory || null,
        parentQuotationId: importParams?.parentQuotationId || null
      };
      
      // For comparative statements, use categoryName instead of vendorId
      if (isComparativeStatement) {
        // Store the category name - comparative statements are identified by category, not vendor
        projectVendorData.category = importParams?.categoryName || 'Unknown Category';
        projectVendorData.vendorId = null; // Explicitly set to null for comparative statements
        console.log(`📋 Comparative statement: category="${projectVendorData.category}", vendorId=null`);
      } else {
        // Regular quote: use the provided vendorId
        projectVendorData.vendorId = vendorId;
      }
      
      // Add unitRateSubtype if provided
      if (importParams?.unitRateSubtype) {
        projectVendorData.unitRateSubtype = importParams.unitRateSubtype;
      }
      console.log(`📋 Project vendor data:`, JSON.stringify(projectVendorData, null, 2));

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

  // Temporary storage for conflict resolution (in-memory)
  const tempQuoteStorage = new Map<string, {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
    parsedData: any;
    projectId: string;
    vendorId: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    unitRateSubtype?: string;
  }>();

  // Quote Import Routes
  app.post("/api/quotes/import", requireAdmin, upload.single('quoteFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { projectId, vendorId, categoryId, categoryName, quoteType, unitRateSubtype } = req.body;
      
      // DEBUG: Log the received quoteType and unitRateSubtype
      console.log(`📋 Quote Import - File: ${req.file.originalname}, quoteType received: "${quoteType}", Type: ${typeof quoteType}`);
      console.log(`📋 Is Unit Rate? ${quoteType === 'unitrate'}, Unit Rate Subtype: ${unitRateSubtype}`);
      console.log(`📋 Comparative Statement? categoryId: ${categoryId}, vendorId: ${vendorId}`);
      
      // Validation: comparative statements require categoryId, regular quotes require vendorId
      const isComparativeStatement = unitRateSubtype === 'comparative';
      
      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required" });
      }
      
      if (isComparativeStatement) {
        if (!categoryId) {
          return res.status(400).json({ error: "Category ID is required for comparative statements" });
        }
      } else {
        if (!vendorId) {
          return res.status(400).json({ error: "Vendor ID is required" });
        }
      }

      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Verify vendor exists (only for regular quotes)
      let vendor = null;
      if (!isComparativeStatement) {
        vendor = await storage.getVendor(vendorId);
        if (!vendor) {
          return res.status(404).json({ error: "Vendor not found" });
        }
      }

      // Parse the uploaded file from buffer
      const isUnitRate = quoteType === 'unitrate';
      console.log(`📋 Passing isUnitRate=${isUnitRate} to parseQuoteFile`);
      const data = await parseQuoteFile(req.file.buffer, req.file.mimetype, req.file.originalname, isUnitRate);
      
      if (!data || data.length === 0) {
        return res.status(400).json({ error: "No valid data found in file" });
      }

      // Check for existing quotes (logic differs for comparative statements vs regular quotes)
      const allProjectVendors = await storage.getProjectVendors(projectId);
      
      let existingQuotes;
      if (isComparativeStatement) {
        // For comparative statements: check by category, not by vendor
        // Comparative statements only conflict with other comparative statements in the same category
        existingQuotes = allProjectVendors.filter(pv => {
          if (pv.quotationValue === null || pv.quotationValue === undefined) return false;
          if (pv.unitRateSubtype !== 'comparative') return false;
          
          // Match by category name - comparative statements are identified by category
          return pv.category === categoryName;
        });
      } else {
        // For regular quotes: check by vendor
        // Regular quotes only conflict with other regular quotes from the same vendor (not comparative statements)
        existingQuotes = allProjectVendors.filter(pv => {
          if (pv.vendorId !== vendorId) return false;
          if (pv.quotationValue === null || pv.quotationValue === undefined) return false;
          
          // Exclude comparative statements
          return pv.unitRateSubtype !== 'comparative';
        });
      }
      
      if (existingQuotes.length > 0) {
        // Generate a temporary ID and store file data in memory for conflict resolution
        const tempFileId = crypto.randomUUID();
        tempQuoteStorage.set(tempFileId, {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          parsedData: data,
          projectId,
          vendorId: vendorId || null,
          categoryId: categoryId || null,
          categoryName: categoryName || null,
          unitRateSubtype
        });
        
        // Return conflict response with appropriate message
        const conflictMessage = isComparativeStatement
          ? "A comparative statement already exists for this category in this project."
          : "This vendor already has quotes for this project. Please specify if this is an option for existing items or a new item category.";
        
        return res.status(409).json({
          conflictType: "existing_quotes",
          message: conflictMessage,
          existingQuotes: existingQuotes.map(quote => ({
            id: quote.id,
            quotationName: quote.quotationName || "Main Quote",
            quotationType: quote.quotationType || "item",
            quotationValue: quote.quotationValue,
            itemCategory: quote.itemCategory
          })),
          tempFileId: tempFileId,
          parsedDataPreview: {
            totalItems: (data.items || data).length,
            estimatedValue: data.totals?.grandTotal || 0
          }
        });
      }

      // Process the quote import (no conflict)
      // For comparative statements, we need to pass categoryId and categoryName instead of vendorId
      const results = await processQuoteImport(
        data, 
        projectId, 
        isComparativeStatement ? null : vendorId,
        unitRateSubtype ? { unitRateSubtype, categoryId, categoryName } : undefined
      );
      
      // Upload file to object storage
      const userId = (req.user as any).claims.sub;
      const objectPath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      );
      
      // Store file information
      const quoteFileData = {
        projectVendorId: results.projectVendor.id,
        fileName: req.file.originalname,
        filePath: objectPath,
        fileType: path.extname(req.file.originalname).toLowerCase(),
        fileSize: req.file.size.toString()
      };
      
      await storage.createQuoteFile(quoteFileData);

      // Update project vendor with file path
      await storage.updateProjectVendor(results.projectVendor.id, {
        quotationFile: objectPath
      });

      console.log(`Stored quote file at object storage: ${objectPath}`);

      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          const activityDescription = isComparativeStatement
            ? `uploaded comparative statement for ${categoryName} - ${project.projectName}`
            : `uploaded quotation for ${vendor?.name} - ${project.projectName}`;
          
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'quote_upload',
            fileName: req.file.originalname,
            filePath: objectPath,
            description: activityDescription,
            projectId: projectId,
            metadata: {
              projectVendorId: results.projectVendor.id,
              vendorId: vendorId || null,
              categoryId: isComparativeStatement ? categoryId : null,
              categoryName: isComparativeStatement ? categoryName : null,
              quotationValue: results.projectVendor.quotationValue
            }
          });
          console.log(`Activity logged for quote upload: ${req.file.originalname}`);
        } catch (activityError) {
          console.error('Error logging activity:', activityError);
        }
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
      
      res.status(500).json({ 
        error: "Failed to import quote",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Resolve import conflict - when user decides if it's option or new item
  app.post("/api/quotes/import/resolve", requireAdmin, async (req, res) => {
    try {
      const { 
        tempFileId, 
        projectId, 
        vendorId, 
        categoryId,
        categoryName,
        resolutionType, 
        quotationName, 
        itemCategory, 
        parentQuotationId,
        unitRateSubtype 
      } = req.body;
      
      // Retrieve stored file data from memory to check if it's comparative
      const tempData = tempQuoteStorage.get(tempFileId);
      if (!tempData) {
        return res.status(404).json({ error: "Temporary file not found. Please re-upload the file." });
      }
      
      const isComparativeStatement = tempData.unitRateSubtype === 'comparative';
      
      // Validate required fields based on type
      if (!tempFileId || !projectId || !resolutionType) {
        return res.status(400).json({ 
          error: "Missing required parameters: tempFileId, projectId, resolutionType" 
        });
      }
      
      if (isComparativeStatement) {
        // For comparative statements adding to existing category (option), categoryId is required
        if (resolutionType === "option" && !categoryId) {
          return res.status(400).json({ 
            error: "categoryId is required when adding comparative statement to existing category" 
          });
        }
        // For new categories, itemCategory name is required (validated below)
      } else {
        // For regular quotes, vendorId is always required
        if (!vendorId) {
          return res.status(400).json({ 
            error: "vendorId is required for regular quotes" 
          });
        }
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

      // Use the already-parsed data from memory (tempData already retrieved above for validation)
      const data = tempData.parsedData;
      
      if (!data || data.length === 0) {
        return res.status(400).json({ error: "No valid data found in temporary file" });
      }
      
      // Get extension for file storage
      const extension = path.extname(tempData.originalname).toLowerCase();

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
      
      const importParams: any = {
        quotationName: finalQuotationName,
        quotationType: resolutionType === "option" ? "option" : "item",
        itemCategory: itemCategory || null,
        parentQuotationId: resolutionType === "option" ? parentQuotationId : null
      };
      
      // Add unitRateSubtype if provided (from request body or stored temp data)
      const finalUnitRateSubtype = unitRateSubtype || tempData.unitRateSubtype;
      if (finalUnitRateSubtype) {
        importParams.unitRateSubtype = finalUnitRateSubtype;
      }
      
      // Add category info for comparative statements
      if (isComparativeStatement) {
        importParams.categoryId = categoryId || tempData.categoryId;
        importParams.categoryName = categoryName || tempData.categoryName;
      }

      // Process the quote import with additional parameters
      // For comparative statements, pass null as vendorId
      const results = await processQuoteImport(
        data, 
        projectId, 
        isComparativeStatement ? null : vendorId, 
        importParams
      );
      
      // Upload file to object storage
      const userId = (req.user as any).claims.sub;
      const objectPath = await uploadToObjectStorage(
        tempData.buffer,
        tempData.originalname,
        userId,
        tempData.mimetype
      );
      
      // Store file information
      const quoteFileData = {
        projectVendorId: results.projectVendor.id,
        fileName: tempData.originalname,
        filePath: objectPath,
        fileType: extension,
        fileSize: tempData.size.toString()
      };
      
      await storage.createQuoteFile(quoteFileData);

      // Update project vendor with file path
      await storage.updateProjectVendor(results.projectVendor.id, {
        quotationFile: objectPath
      });
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          const vendor = await storage.getVendor(vendorId);
          const project = await storage.getProject(projectId);
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'quote_upload',
            fileName: tempData.originalname,
            filePath: objectPath,
            description: `uploaded quotation for ${vendor?.name || 'vendor'} - ${project?.projectName || 'project'}`,
            projectId: projectId,
            metadata: {
              projectVendorId: results.projectVendor.id,
              vendorId: vendorId,
              quotationValue: results.projectVendor.quotationValue,
              quotationType: resolutionType
            }
          });
          console.log(`Activity logged for quote upload: ${tempData.originalname}`);
        } catch (activityError) {
          console.error('Error logging activity:', activityError);
        }
      }
      
      // Clean up temporary storage
      tempQuoteStorage.delete(tempFileId);

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
  const parseTemplateFile = async (fileBuffer: Buffer, mimeType: string): Promise<any[]> => {
    try {
      if (mimeType.includes('excel') || mimeType.includes('sheet')) {
        // Parse Excel file from buffer
        const workbook = XLSX.read(fileBuffer, { cellText: false, cellDates: true });
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
        // Parse CSV file from buffer
        const csvData = fileBuffer.toString('utf8');
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
    let statusCode = 500;
    let responseData: any = { error: "Failed to import template" };

    try {
      if (!req.file) {
        statusCode = 400;
        responseData = { error: "No file uploaded" };
        return;
      }

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

      // Parse the uploaded file from buffer
      const data = await parseTemplateFile(req.file.buffer, req.file.mimetype);
      
      if (!data || data.length === 0) {
        statusCode = 400;
        responseData = { error: "No valid data found in file" };
        return;
      }

      // Get raw Excel data for spreadsheet storage from buffer
      const workbook = XLSX.read(req.file.buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawExcelData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '',
        blankrows: false
      });

      // Store original file data as Base64 for downloads
      const originalFileData = req.file.buffer.toString('base64');
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method for consistent access control
      const boqItems = await storage.getBOQForUser(userId, role, projectVendorId);
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method for consistent access control
      const files = await storage.getQuoteFilesForUser(userId, role, projectVendorId);
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method for consistent access control
      const floorPlans = await storage.getFloorPlansForUser(userId, role);
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method with project ID filter
      const floorPlans = await storage.getFloorPlansForUser(userId, role, projectId);
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Get user's accessible floor plans and check if this one is included
      const userFloorPlans = await storage.getFloorPlansForUser(userId, role);
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
      fileSize: 100 * 1024 * 1024, // 100MB limit for floor plan files
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
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email || '',
          activityType: 'floor_plan_upload' as any,
          fileName: req.file.originalname,
          description: `uploaded floor plan: ${name}`,
          projectId: projectId,
          metadata: { floorPlanId: floorPlan.id, version: floorPlan.version }
        });
      }
      
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
      const userId = (req.user as any).claims.sub;
      
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
      
      // Log deletion activity
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email || '',
          projectId: floorPlan.projectId,
          activityType: 'floor_plan_delete' as any,
          fileName: floorPlan.fileName,
          filePath: floorPlan.filePath,
          description: `deleted Floor Plan "${floorPlan.name}"`,
          timestamp: new Date(),
        });
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
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      // Use role-based helper method for consistent access control
      const moodboards = await storage.getMoodboardsForUser(userId, role, validProjectId, validAssetType);
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
  app.post("/api/moodboards", requireAdmin, uploadMoodboard.single('moodboard'), async (req, res) => {
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
      
      // Log activity (only for file uploads, not link-only)
      if (!isLinkOnly && req.file) {
        const userId = (req.user as any).claims.sub;
        const user = await storage.getUser(userId);
        if (user) {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: (assetType === 'render' ? 'render_upload' : assetType === 'working_drawing' ? 'working_drawing_upload' : 'moodboard_upload') as any,
            fileName: req.file.originalname,
            description: `uploaded ${assetType === 'render' ? 'render' : assetType === 'working_drawing' ? 'working drawing' : 'moodboard'}: ${req.file.originalname}`,
            projectId: validatedProjectId,
            metadata: { moodboardId: moodboard.id, assetType: moodboard.assetType }
          });
        }
      }
      
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
      const userId = (req.user as any).claims.sub;
      
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
        if (moodboard.filePath && fs.existsSync(moodboard.filePath)) {
          fs.unlinkSync(moodboard.filePath);
        }
      } catch (fileError) {
        console.warn('Warning: Could not delete physical file:', fileError);
        // Don't fail the request if file deletion fails
      }
      
      // Log deletion activity
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        const assetTypeLabel = moodboard.assetType === 'render' ? 'Render' : 
                               moodboard.assetType === 'working_drawing' ? 'Working Drawing' : 'Moodboard';
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email || '',
          projectId: moodboard.projectId || undefined,
          activityType: `${moodboard.assetType}_delete` as any,
          fileName: moodboard.fileName || moodboard.name,
          filePath: moodboard.filePath || undefined,
          description: `deleted ${assetTypeLabel} "${moodboard.name}"`,
          timestamp: new Date(),
        });
      }
      
      res.json({ message: "Moodboard deleted successfully" });
    } catch (error) {
      console.error('Error deleting moodboard:', error);
      res.status(500).json({ error: "Failed to delete moodboard" });
    }
  });

  // Task Management API Routes

  // Get all tasks across all projects
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching all tasks:', error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get all tasks for a project
  app.get("/api/tasks/project/:projectId", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const tasks = await storage.getTasksByProject(projectId);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get single task
  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // Create task
  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Update task
  app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate with partial schema for updates
      const validatedData = insertTaskSchema.partial().parse(req.body);
      
      const task = await storage.updateTask(id, validatedData);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error('Error updating task:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTask(id);
      if (!deleted) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Import tasks from CSV
  app.post("/api/tasks/import/csv", requireAdmin, multer().single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { projectId } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }

      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
      });

      if (parseResult.errors && parseResult.errors.length > 0) {
        return res.status(400).json({ 
          error: "CSV parsing failed", 
          details: parseResult.errors 
        });
      }

      const createdTasks = [];
      const errors: Array<{ row: number; error: string; data: any }> = [];
      
      for (let i = 0; i < parseResult.data.length; i++) {
        const row: any = parseResult.data[i];
        
        try {
          // Map CSV columns to task fields (flexible column names)
          // Support both standard and Gantt chart CSV formats
          
          // Extract numeric value from duration (e.g., "70 day" -> "70")
          // Duration is decimal type so needs to be a string
          const durationValue = row.duration || row.Duration || row.DURATION || null;
          const durationString = durationValue ? String(parseInt(String(durationValue).replace(/[^\d]/g, '')) || 0) : null;
          
          // Progress percentage must also be a string for decimal field
          const progressValue = row.progress || row.Progress || row.PROGRESS || row.progressPercentage || row['% Complete'];
          const progressString = progressValue !== undefined && progressValue !== '' && progressValue !== null 
            ? String(progressValue) 
            : '0';
          
          const taskData = {
            projectId,
            name: row.name || row.Name || row.task || row.Task || row.TASK,
            description: row.description || row.Description || row.DESCRIPTION || row.Notes || '',
            startDate: row.startDate || row.start_date || row['Start Date'] || row.START_DATE || row.Start,
            endDate: row.endDate || row.end_date || row['End Date'] || row.END_DATE || row.Finish,
            duration: durationString,
            assignedTo: row.assignedTo || row.assigned_to || row['Assigned To'] || row.ASSIGNED_TO || row['Resource Names'] || null,
            status: row.status || row.Status || row.STATUS || 'not_started',
            priority: row.priority || row.Priority || row.PRIORITY || 'medium',
            progressPercentage: progressString,
            approvalRequired: row.approvalRequired === 'true' || row.approval_required === 'true' || false,
          };

          // Validate required fields before schema validation
          if (!taskData.name) {
            throw new Error("Task name is required");
          }
          if (!taskData.startDate) {
            throw new Error("Start date is required");
          }
          if (!taskData.endDate) {
            throw new Error("End date is required");
          }

          // Validate with schema
          const validatedData = insertTaskSchema.parse(taskData);
          const task = await storage.createTask(validatedData);
          createdTasks.push(task);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Invalid data';
          console.log(`CSV Import Error on row ${i + 2}:`, errorMessage, 'Data:', row);
          errors.push({
            row: i + 2, // +2 for header row and 1-based indexing
            error: errorMessage,
            data: row
          });
        }
      }

      console.log(`CSV Import complete: ${createdTasks.length} success, ${errors.length} failed`);
      if (errors.length > 0) {
        console.log('First 3 errors:', errors.slice(0, 3));
      }

      res.status(201).json({
        message: `Imported ${createdTasks.length} of ${parseResult.data.length} tasks successfully`,
        success: createdTasks.length,
        failed: errors.length,
        tasks: createdTasks,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Error importing tasks:', error);
      res.status(500).json({ error: "Failed to import tasks" });
    }
  });

  // Download Gantt template
  app.get("/api/templates/gantt", requireAuth, (req, res) => {
    const filePath = path.join(process.cwd(), 'attached_assets', 'gantt_template.xlsx');
    res.download(filePath, 'Interior_Gantt_Template.xlsx', (err) => {
      if (err) {
        console.error('Error downloading Gantt template:', err);
        res.status(500).json({ error: "Failed to download template" });
      }
    });
  });

  // Download Dependencies template
  app.get("/api/templates/dependencies", requireAuth, (req, res) => {
    const filePath = path.join(process.cwd(), 'attached_assets', 'dependencies_template.xlsx');
    res.download(filePath, 'Dependencies_Template.xlsx', (err) => {
      if (err) {
        console.error('Error downloading Dependencies template:', err);
        res.status(500).json({ error: "Failed to download template" });
      }
    });
  });

  // Download test file with 5 sample tasks
  app.get("/api/templates/test-sample", requireAuth, (req, res) => {
    const filePath = path.join(process.cwd(), 'attached_assets', 'sample_new_5_tasks.xlsx');
    res.download(filePath, 'Sample_New_5_Tasks.xlsx', (err) => {
      if (err) {
        console.error('Error downloading test sample:', err);
        res.status(500).json({ error: "Failed to download test file" });
      }
    });
  });

  // Export schedule to Excel
  app.get("/api/schedules/export/:projectId", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get all tasks for this project
      const tasks = await storage.getProjectTasks(projectId);
      
      // Create a map of task ID to external task ID (with fallback that avoids collisions)
      const taskIdMap: Record<string, string> = {};
      const usedExternalIds = new Set<string>();
      
      // First pass: collect all existing external IDs
      tasks.forEach(task => {
        if (task.taskId) {
          usedExternalIds.add(task.taskId);
        }
      });
      
      // Second pass: assign external IDs (using existing or generating non-colliding fallbacks)
      let fallbackCounter = 1;
      tasks.forEach(task => {
        if (task.taskId) {
          taskIdMap[task.id] = task.taskId;
        } else {
          // Find next available sequential ID that doesn't collide
          while (usedExternalIds.has(String(fallbackCounter))) {
            fallbackCounter++;
          }
          const fallbackId = String(fallbackCounter);
          taskIdMap[task.id] = fallbackId;
          usedExternalIds.add(fallbackId);
          fallbackCounter++;
        }
      });
      
      // Fetch all task dependencies in parallel (avoid N+1 query problem)
      const dependencyPromises = tasks.map(task => storage.getTaskDependencies(task.id));
      const dependencyResults = await Promise.all(dependencyPromises);
      
      // Build dependencies map
      const depTypeAbbrev: Record<string, string> = {
        'finish_to_start': 'FS',
        'start_to_start': 'SS',
        'finish_to_finish': 'FF',
        'start_to_finish': 'SF',
      };
      
      const allDependencies: Record<string, string[]> = {};
      tasks.forEach((task, index) => {
        const deps = dependencyResults[index];
        if (deps.length > 0) {
          // Format dependencies as TaskID(Type) or TaskID(Type)+lag
          allDependencies[task.id] = deps.map(dep => {
            const taskId = taskIdMap[dep.fromTaskId] || dep.fromTaskId;
            const typeAbbrev = depTypeAbbrev[dep.dependencyType] || 'FS';
            
            let formatted = `${taskId}(${typeAbbrev})`;
            const lagValue = dep.lag ? parseFloat(dep.lag) : 0;
            if (lagValue && lagValue !== 0) {
              formatted += lagValue > 0 ? `+${lagValue}` : `${lagValue}`;
            }
            return formatted;
          });
        }
      });
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Headers matching the template format
      const headers = [
        'ID',
        'Name',
        'Start',
        'Finish',
        'Duration',
        '% Complete',
        'Predecessors',
        'Resource Names',
        'Status',
        'Priority',
        'Approval Required',
        'Materials',
        'Owner',
        'Target Start',
        'Target Finish',
        'Remarks',
        'Outline Level',
        'Color'
      ];
      
      const data = [headers];
      
      // Add each task as a row
      for (const task of tasks) {
        const row = [
          taskIdMap[task.id], // ID (using consistent external ID)
          task.name || '', // Name
          task.startDate || '', // Start
          task.endDate || '', // Finish
          task.duration || '', // Duration
          task.progressPercentage || '0', // % Complete
          allDependencies[task.id]?.join(',') || '', // Predecessors (from dependencies table)
          task.resourceNames || '', // Resource Names
          task.status || 'not_started', // Status
          task.priority || 'medium', // Priority
          task.approvalRequired ? 'Y' : 'N', // Approval Required
          task.materials || '', // Materials
          task.owner || '', // Owner
          task.targetStartDate || '', // Target Start
          task.targetEndDate || '', // Target Finish
          task.remarks || task.description || '', // Remarks
          task.outlineLevel || '2', // Outline Level
          task.color || '' // Color
        ];
        data.push(row);
      }
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 6 },   // ID
        { wch: 45 },  // Name
        { wch: 12 },  // Start
        { wch: 12 },  // Finish
        { wch: 10 },  // Duration
        { wch: 12 },  // % Complete
        { wch: 20 },  // Predecessors
        { wch: 20 },  // Resource Names
        { wch: 14 },  // Status
        { wch: 10 },  // Priority
        { wch: 16 },  // Approval Required
        { wch: 25 },  // Materials
        { wch: 20 },  // Owner
        { wch: 12 },  // Target Start
        { wch: 12 },  // Target Finish
        { wch: 30 },  // Remarks
        { wch: 14 },  // Outline Level
        { wch: 10 }   // Color
      ];
      
      // Add freeze panes and auto-filter
      ws['!freeze'] = { xSplit: 2, ySplit: 1 };
      ws['!autofilter'] = { ref: `A1:R${data.length}` };
      
      XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
      
      // Create Instructions sheet
      const instructions = [
        ['PixelCraft Designer - Project Schedule Export'],
        [''],
        [`Project: ${project.name}`],
        [`Exported: ${new Date().toISOString().split('T')[0]}`],
        [`Total Tasks: ${tasks.length}`],
        [''],
        ['This file contains your complete project schedule with all task data.'],
        ['You can edit it and re-import to update your project schedule.'],
        [''],
        ['COLUMN REFERENCE'],
        ['Column', 'Description'],
        ['ID', 'Task identifier'],
        ['Name', 'Task name'],
        ['Start', 'Start date (YYYY-MM-DD)'],
        ['Finish', 'End date (YYYY-MM-DD)'],
        ['Duration', 'Working days'],
        ['% Complete', 'Progress (0-100)'],
        ['Predecessors', 'Dependencies (TaskID(Type) format)'],
        ['Resource Names', 'Assigned team'],
        ['Status', 'Current status'],
        ['Priority', 'Task priority'],
        ['Approval Required', 'Y or N'],
        ['Materials', 'Required materials'],
        ['Owner', 'Task owner'],
        ['Target Start', 'Planned start date'],
        ['Target Finish', 'Planned finish date'],
        ['Remarks', 'Additional notes'],
        ['Outline Level', '1=Phase/Package, 2=Task'],
        ['Color', 'Task color (hex code)']
      ];
      
      const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
      wsInstructions['!cols'] = [{ wch: 20 }, { wch: 55 }];
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
      
      // Write to buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      // Send file
      const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_Schedule_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
      
    } catch (error) {
      console.error('Error exporting schedule:', error);
      res.status(500).json({ error: "Failed to export schedule" });
    }
  });

  // Get project schedules
  app.get("/api/schedules/project/:projectId", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const schedules = await storage.getProjectSchedules(projectId);
      res.json(schedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });

  // Delete schedule
  app.delete("/api/schedules/:scheduleId", requireAuth, async (req, res) => {
    try {
      const { scheduleId } = req.params;
      await storage.deleteProjectSchedule(scheduleId);
      res.json({ success: true, message: "Schedule deleted successfully" });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  // Import schedule (CSV/XLSX) with file storage and dependency parsing
  app.post("/api/schedules/import", requireAdmin, multer().single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { projectId, version } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID required" });
      }

      const userId = (req.user as any).claims.sub;
      
      // Upload file to object storage
      const filePath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      );

      // Create schedule record
      const schedule = await storage.createProjectSchedule({
        projectId,
        fileName: req.file.originalname,
        version: version || '1.0',
        filePath,
        fileSize: String(req.file.size),
        status: 'active',
      });

      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email || '',
          activityType: 'schedule_upload' as any,
          description: `Uploaded project schedule: ${req.file.originalname}`,
          fileName: req.file.originalname,
          projectId: projectId,
          metadata: { scheduleId: schedule.id, version: schedule.version }
        });
      }

      // Parse the file and import tasks
      let taskData: any[] = [];
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const workbook = XLSX.read(req.file.buffer);
        // Try multiple common sheet names, then fall back to first sheet (excluding Instructions)
        const sheetNames = ['Gantt', 'Schedule', 'Tasks', 'Project Schedule', 'Timeline'];
        let targetSheet = null;
        let usedSheetName = '';
        
        // First try common sheet names
        for (const name of sheetNames) {
          if (workbook.Sheets[name]) {
            targetSheet = workbook.Sheets[name];
            usedSheetName = name;
            break;
          }
        }
        
        // If no common name found, use the first sheet that's not "Instructions"
        if (!targetSheet && workbook.SheetNames.length > 0) {
          for (const name of workbook.SheetNames) {
            if (name.toLowerCase() !== 'instructions') {
              targetSheet = workbook.Sheets[name];
              usedSheetName = name;
              break;
            }
          }
        }
        
        if (targetSheet) {
          console.log(`Using sheet: "${usedSheetName}" from Excel file`);
          // Use raw: false to convert Excel date serial numbers to date strings
          taskData = XLSX.utils.sheet_to_json(targetSheet, { defval: null, raw: false });
        } else {
          console.log('No suitable sheet found in Excel file. Available sheets:', workbook.SheetNames);
        }
      } else if (fileExtension === 'csv') {
        const csvContent = req.file.buffer.toString('utf-8');
        const parseResult = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
        taskData = parseResult.data;
      } else {
        return res.status(400).json({ error: "Unsupported file format. Use CSV or XLSX" });
      }

      // Helper function to parse and normalize dates
      const parseDate = (dateValue: any): string | null => {
        // Return null for empty/missing dates - don't default to today
        if (!dateValue) return null;
        
        // If it's already a valid date string (YYYY-MM-DD), return it
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        
        // Try to parse as a date
        try {
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Fall through to null
        }
        
        return null;
      };

      const createdTasks = [];
      const errors: Array<{ row: number; error: string; data: any }> = [];

      // Helper to check if task name is a header row (PHASE, PACKAGE, or EXECUTE sections)
      const isHeaderRow = (name: string): boolean => {
        if (!name) return false;
        const upper = name.toUpperCase();
        return upper.startsWith('PHASE') || upper.startsWith('PACKAGE') || upper.startsWith('EXECUTE');
      };
      
      // Placeholder date for header rows (far in future to avoid alerts)
      const HEADER_PLACEHOLDER_DATE = '2099-12-31';
      
      for (let i = 0; i < taskData.length; i++) {
        const row: any = taskData[i];
        
        try {
          const taskId = String(row.ID || row.id || '');
          const name = row.Name || row.name || '';
          if (!name || !taskId) continue;

          const durationValue = row.Duration || row.duration || null;
          const durationString = durationValue ? String(parseInt(String(durationValue).replace(/[^\d]/g, '')) || 0) : null;
          
          const progressValue = row['% Complete'] || row.progress || 0;
          const progressString = String(progressValue || 0);
          
          // Parse dates
          let startDate = parseDate(row.Start || row.start);
          let endDate = parseDate(row.Finish || row.finish || row.End);
          
          // For any row without dates, use placeholder
          // This satisfies NOT NULL constraint but won't trigger false "due today" alerts
          // Tasks with missing dates are essentially "unscheduled" and need manual date entry
          startDate = startDate || HEADER_PLACEHOLDER_DATE;
          endDate = endDate || HEADER_PLACEHOLDER_DATE;

          const taskRecord = {
            projectId,
            scheduleId: schedule.id,
            taskId,
            name,
            description: row.Remarks || row.remarks || row.Notes || '',
            startDate,
            endDate,
            duration: durationString,
            assignedTo: null, // Don't import resource names as user IDs - set manually later
            status: 'not_started',
            priority: 'medium',
            progressPercentage: progressString,
            approvalRequired: (row['Approval Required'] || row.approvalRequired || 'N') === 'Y',
            materials: row.Materials || row.materials || null,
            owner: row.Owner || row.owner || null,
            targetStartDate: row['Target Start'] || row.targetStart ? parseDate(row['Target Start'] || row.targetStart) : null,
            targetEndDate: row['Target Finish'] || row.targetFinish ? parseDate(row['Target Finish'] || row.targetFinish) : null,
            remarks: row.Remarks || row.remarks || null,
            outlineLevel: row['Outline Level'] || row.outlineLevel || null,
            color: row.Color || row.color || null,
          };

          const validatedData = insertTaskSchema.parse(taskRecord);
          const task = await storage.createTask(validatedData);
          createdTasks.push(task);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Invalid data';
          errors.push({ row: i + 2, error: errorMessage, data: row });
        }
      }

      // Note: Dependencies/predecessors are not imported - focusing on task alerts instead
      
      res.status(201).json({
        message: `Imported schedule with ${createdTasks.length} tasks`,
        schedule,
        tasksCreated: createdTasks.length,
        tasksFailed: errors.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      });
    } catch (error) {
      console.error('Error importing schedule:', error);
      res.status(500).json({ error: "Failed to import schedule" });
    }
  });

  // Designer Excel Export - Formatted schedule with colors and styling
  app.get("/api/schedules/:scheduleId/designer-export", requireAuth, async (req, res) => {
    try {
      const { scheduleId } = req.params;
      const userId = (req.user as any).claims.sub;
      
      // Get the schedule and its tasks
      const schedule = await storage.getProjectSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      // Require schedule to have a valid project association
      if (!schedule.projectId) {
        return res.status(404).json({ error: "Schedule is not associated with a project" });
      }
      
      const project = await storage.getProject(schedule.projectId);
      if (!project) {
        return res.status(404).json({ error: "Associated project not found" });
      }
      
      // Authorization check - verify user can access this project
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role;
      
      // Admin and designer can export any schedule without project assignment check
      const isPrivilegedRole = role === 'admin' || role === 'designer';
      
      if (!isPrivilegedRole) {
        // All other users (including undefined roles) must have explicit project assignment
        const assignments = await storage.getUserProjectAssignments(userId);
        const hasAccess = assignments.some(a => a.projectId === schedule.projectId);
        if (!hasAccess) {
          return res.status(403).json({ error: "Not authorized to access this schedule" });
        }
      }
      
      const tasks = await storage.getTasksBySchedule(scheduleId);
      
      // Create a new workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PixelCraft Designer';
      workbook.created = new Date();
      
      // Add Designer Schedule sheet FIRST (so it's the active sheet when opened)
      const worksheet = workbook.addWorksheet('Designer Schedule', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });
      
      // Define columns - Designer-friendly view (Status and Priority columns removed per user request)
      // Dates stored as Excel dates for calendar picker functionality
      // Progress column uses "Incomplete" / "Completed" text (not percentages) to reduce designer workload
      worksheet.columns = [
        { header: '#', key: 'seq', width: 5 },
        { header: 'Task Name', key: 'name', width: 45 },
        { header: 'Start Date', key: 'startDate', width: 14 },
        { header: 'End Date', key: 'endDate', width: 14 },
        { header: 'Status', key: 'progress', width: 14 },
        { header: 'Remarks', key: 'remarks', width: 35 },
        // Hidden columns for re-import functionality
        { header: 'DB_ID', key: 'dbId', width: 40, hidden: true }, // Database ID for re-import
        { header: 'Schedule_ID', key: 'scheduleId', width: 40, hidden: true }, // Schedule ID for validation
        { header: 'Priority', key: 'priority', width: 12, hidden: true },
        { header: 'Duration', key: 'duration', width: 10, hidden: true },
        { header: 'Task ID', key: 'taskId', width: 12, hidden: true },
        { header: 'Assigned To', key: 'assignedTo', width: 18, hidden: true },
      ];
      
      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A365D' } // Dark blue header
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;
      
      // Apply date format to entire date columns (C and D) so manually entered dates use correct format
      // This ensures new dates typed by users will display as "DD MMM YYYY" (e.g., "01 Dec 2025")
      const startDateColumn = worksheet.getColumn('startDate');
      const endDateColumn = worksheet.getColumn('endDate');
      startDateColumn.numFmt = 'DD MMM YYYY';
      endDateColumn.numFmt = 'DD MMM YYYY';
      
      // Color mapping for priority
      const priorityColors: Record<string, { bg: string; text: string }> = {
        'critical': { bg: 'FFF8D7DA', text: 'FF721C24' },       // Red
        'high': { bg: 'FFFFF3CD', text: 'FF856404' },           // Orange/Yellow
        'medium': { bg: 'FFFEF9E7', text: 'FF856404' },         // Light yellow
        'low': { bg: 'FFD4EDDA', text: 'FF155724' },            // Green
      };
      
      // Helper to check if task is a phase/package/execute header
      const isPhaseHeader = (name: string) => {
        if (!name) return false;
        const upper = name.toUpperCase();
        return upper.includes('PHASE') || upper.includes('PACKAGE') || upper.includes('EXECUTE');
      };
      
      // Placeholder date used for headers/unscheduled tasks
      const PLACEHOLDER_DATE = '2099-12-31';
      
      // Helper to check if task is overdue
      const isOverdue = (task: any) => {
        if (task.status === 'completed') return false;
        if (!task.endDate) return false;
        return new Date(task.endDate) < new Date();
      };
      
      // Sort tasks by task_id to preserve original Excel order
      const sortedTasks = [...tasks].sort((a, b) => {
        const idA = parseInt(a.taskId || '0', 10);
        const idB = parseInt(b.taskId || '0', 10);
        return idA - idB;
      });
      
      // Track row numbers for blank row insertion
      const blankRowsAfter = [7, 130]; // Insert 2 blank rows after these task numbers
      
      // Add data rows
      let seq = 1;
      for (const task of sortedTasks) {
        const isPhase = isPhaseHeader(task.name || '');
        const taskOverdue = isOverdue(task);
        
        // Check if dates are placeholder dates (headers/unscheduled)
        const isPlaceholderStart = task.startDate === PLACEHOLDER_DATE;
        const isPlaceholderEnd = task.endDate === PLACEHOLDER_DATE;
        
        // For dates, use actual Date objects so Excel can show calendar picker
        // For headers and placeholder dates, leave blank
        const getDateValue = (date: string | null, isPlaceholder: boolean) => {
          if (!date || isPlaceholder) return null;
          return new Date(date);
        };
        
        // Calculate progress state - "Incomplete" or "Completed" (based on stored progressPercentage only)
        // Tasks must be explicitly marked as complete - no auto-completion
        const getProgressState = () => {
          if (isPhase) return null; // Headers don't have progress
          const progressNum = Number(task.progressPercentage) || 0;
          return progressNum >= 100 ? 'Completed' : 'Incomplete';
        };
        const progressValue = getProgressState();
        
        const row = worksheet.addRow({
          seq: seq,
          name: task.name || 'Untitled',
          priority: (task.priority || 'medium').toUpperCase(),
          startDate: getDateValue(task.startDate, isPlaceholderStart || isPhase),
          endDate: getDateValue(task.endDate, isPlaceholderEnd || isPhase),
          progress: progressValue,
          remarks: task.remarks || task.description || '',
          dbId: task.id, // Database ID for re-import
          scheduleId: scheduleId, // Schedule ID for validation
          duration: task.duration || '',
          taskId: task.taskId || '',
          assignedTo: task.assignedTo || '',
        });
        
        // Apply date format to date cells so Excel shows calendar picker
        const startDateCell = row.getCell('startDate');
        const endDateCell = row.getCell('endDate');
        if (startDateCell.value) {
          startDateCell.numFmt = 'DD MMM YYYY';
        }
        if (endDateCell.value) {
          endDateCell.numFmt = 'DD MMM YYYY';
        }
        
        // Get reference to progress cell for styling
        const progressCell = row.getCell('progress');
        
        // Insert blank rows after specified task numbers
        if (blankRowsAfter.includes(seq)) {
          worksheet.addRow({});
          worksheet.addRow({});
        }
        
        seq++;
        
        // Style phase header rows
        if (isPhase) {
          row.font = { bold: true, size: 11 };
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8E8E8' } // Light gray for phases
          };
          row.height = 24;
        } else {
          row.height = 20;
        }
        
        // Highlight overdue tasks
        if (taskOverdue) {
          row.getCell('endDate').font = { color: { argb: 'FFDC3545' }, bold: true };
          row.getCell('name').font = { ...row.getCell('name').font, color: { argb: 'FFDC3545' } };
        }
        
        // Style progress cell based on Incomplete/Completed status
        if (progressValue === 'Completed') {
          progressCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF28A745' } };
          progressCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        } else if (progressValue === 'Incomplete') {
          // Light gray background for incomplete tasks
          progressCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
          progressCell.font = { color: { argb: 'FF666666' } };
        }
        progressCell.alignment = { horizontal: 'center' };
        
        // Add borders to all cells
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          };
        });
      }
      
      // Add summary section at the bottom
      worksheet.addRow([]); // Empty row
      const summaryRow = worksheet.addRow({
        seq: '',
        name: 'SUMMARY',
        priority: '',
        startDate: '',
        endDate: '',
        progress: '',
        remarks: ''
      });
      summaryRow.font = { bold: true };
      summaryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A365D' }
      };
      summaryRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      
      // Count completed tasks (based on stored progressPercentage only)
      const isTaskCompleted = (t: any) => {
        return Number(t.progressPercentage) >= 100;
      };
      
      // Filter out phase headers for counting
      const actualTasks = sortedTasks.filter(t => !isPhaseHeader(t.name || ''));
      const totalTasks = actualTasks.length;
      const completedCount = actualTasks.filter(isTaskCompleted).length;
      const incompleteCount = totalTasks - completedCount;
      
      worksheet.addRow({ seq: '', name: `Total Tasks: ${totalTasks}` });
      const completedRow = worksheet.addRow({ seq: '', name: `Completed: ${completedCount} (${totalTasks > 0 ? Math.round(completedCount/totalTasks*100) : 0}%)` });
      completedRow.getCell('name').font = { color: { argb: 'FF28A745' }, bold: true };
      worksheet.addRow({ seq: '', name: `Incomplete: ${incompleteCount}` });
      
      // Auto-filter for the data (6 visible columns now - Priority moved to hidden)
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: sortedTasks.length + 1, column: 6 }
      };
      
      // Add Instructions sheet SECOND (so it's the 2nd tab)
      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.columns = [
        { header: 'Topic', key: 'topic', width: 25 },
        { header: 'Description', key: 'description', width: 80 },
      ];
      
      // Style Instructions header
      const instrHeader = instructionsSheet.getRow(1);
      instrHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      instrHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
      instrHeader.alignment = { vertical: 'middle', horizontal: 'left' };
      instrHeader.height = 24;
      
      // Add instruction rows
      const instructions = [
        { topic: 'Purpose', description: 'This is your Designer Export file. Edit dates here, then re-import to sync changes back to the system.' },
        { topic: '', description: '' },
        { topic: 'DATE FORMAT', description: 'Enter dates in any of these formats:' },
        { topic: '', description: '   • 15 Nov 2025 (recommended)' },
        { topic: '', description: '   • 2025-11-15' },
        { topic: '', description: '   • 15/11/2025' },
        { topic: '', description: '   • Nov 15, 2025' },
        { topic: '', description: '' },
        { topic: 'STATUS', description: 'The Status column shows:' },
        { topic: '', description: '   • "Incomplete" - Task is not yet done' },
        { topic: '', description: '   • "Completed" - Task is finished' },
        { topic: '', description: '   • To mark a task as Completed, type "Completed" in the Status cell' },
        { topic: '', description: '   • To mark a task as Incomplete, type "Incomplete" in the Status cell' },
        { topic: '', description: '' },
        { topic: 'SECTION HEADERS', description: 'Rows containing PHASE, PACKAGE, or EXECUTE are section headers.' },
        { topic: '', description: 'Leave dates and status blank for these rows.' },
        { topic: '', description: '' },
        { topic: 'RE-IMPORT', description: 'After editing, use the "Re-import" button in the app to sync your changes.' },
        { topic: '', description: 'The system will update dates, progress, and remarks for each task.' },
        { topic: '', description: '' },
        { topic: 'HIDDEN COLUMNS', description: 'Columns G onwards contain system IDs. Do NOT modify or delete these.' },
        { topic: '', description: 'They are used to match tasks during re-import.' },
      ];
      
      instructions.forEach(instr => {
        const row = instructionsSheet.addRow(instr);
        if (instr.topic && instr.topic.toUpperCase() === instr.topic && instr.topic !== '') {
          row.font = { bold: true };
        }
      });
      
      // Generate filename
      const projectName = project?.projectName || 'Project';
      const date = new Date().toISOString().split('T')[0];
      const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_Designer_Schedule_${date}.xlsx`;
      
      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Write to response
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Error generating designer export:', error);
      res.status(500).json({ error: "Failed to generate designer export" });
    }
  });

  // Re-import Designer Export - Update tasks from edited Excel file
  app.post("/api/schedules/:scheduleId/designer-reimport", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const { scheduleId } = req.params;
      const userId = (req.user as any).claims.sub;
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Verify schedule exists and user has access
      const schedule = await storage.getProjectSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      // Authorization check
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role;
      const isPrivilegedRole = role === 'admin' || role === 'designer';
      
      if (!isPrivilegedRole) {
        return res.status(403).json({ error: "Only admins and designers can re-import schedules" });
      }
      
      // Parse the Excel file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      
      const worksheet = workbook.getWorksheet('Designer Schedule');
      if (!worksheet) {
        return res.status(400).json({ error: "Invalid Designer Export file - missing 'Designer Schedule' sheet" });
      }
      
      // Find column indices
      const headerRow = worksheet.getRow(1);
      const columnMap: Record<string, number> = {};
      headerRow.eachCell((cell, colNumber) => {
        const value = cell.value?.toString().toLowerCase().trim();
        if (value === '#') columnMap.seq = colNumber;
        if (value === 'task name') columnMap.name = colNumber;
        if (value === 'start date') columnMap.startDate = colNumber;
        if (value === 'end date') columnMap.endDate = colNumber;
        if (value === '% complete') columnMap.progress = colNumber;
        if (value === 'remarks') columnMap.remarks = colNumber;
        if (value === 'db_id') columnMap.dbId = colNumber;
        if (value === 'schedule_id') columnMap.scheduleId = colNumber;
      });
      
      if (!columnMap.dbId) {
        return res.status(400).json({ 
          error: "This file cannot be re-imported. Please use a Designer Export file that was generated after today's update." 
        });
      }
      
      // Process rows and update tasks
      const updates: { id: string; changes: any }[] = [];
      const errors: string[] = [];
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        
        const dbId = row.getCell(columnMap.dbId).value?.toString();
        const rowScheduleId = row.getCell(columnMap.scheduleId).value?.toString();
        
        // Skip rows without DB ID (summary rows, blank rows)
        if (!dbId || dbId === '') return;
        
        // Validate schedule ID matches
        if (rowScheduleId && rowScheduleId !== scheduleId) {
          errors.push(`Row ${rowNumber}: Task belongs to a different schedule`);
          return;
        }
        
        // Extract values
        const startDateCell = row.getCell(columnMap.startDate);
        const endDateCell = row.getCell(columnMap.endDate);
        const progressCell = row.getCell(columnMap.progress);
        const remarksCell = row.getCell(columnMap.remarks);
        
        // Parse dates - handle Date objects, Excel serial numbers, and formatted strings
        const parseExcelDate = (cell: any): string | null => {
          const value = cell.value;
          if (!value) return null;
          
          // Handle Date object
          if (value instanceof Date) {
            if (isNaN(value.getTime())) return null;
            return value.toISOString().split('T')[0];
          }
          
          // Handle Excel serial date number
          if (typeof value === 'number') {
            // Excel serial date: days since 1900-01-01 (with a bug for 1900 leap year)
            // Convert to JavaScript timestamp
            const excelEpoch = new Date(1899, 11, 30); // Excel epoch is Dec 30, 1899
            const date = new Date(excelEpoch.getTime() + value * 86400 * 1000);
            if (isNaN(date.getTime())) return null;
            return date.toISOString().split('T')[0];
          }
          
          // Handle string dates
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            
            // Try parsing various date formats
            const parsed = new Date(trimmed);
            if (!isNaN(parsed.getTime())) {
              return parsed.toISOString().split('T')[0];
            }
            
            // Try DD MMM YYYY format (e.g., "15 Nov 2025")
            const ddMmmYyyy = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
            if (ddMmmYyyy) {
              const months: Record<string, number> = {
                jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
              };
              const month = months[ddMmmYyyy[2].toLowerCase()];
              if (month !== undefined) {
                const date = new Date(parseInt(ddMmmYyyy[3]), month, parseInt(ddMmmYyyy[1]));
                if (!isNaN(date.getTime())) {
                  return date.toISOString().split('T')[0];
                }
              }
            }
          }
          
          return null;
        };
        
        // Parse progress - handle "Completed"/"Incomplete" text format
        const parseProgress = (cell: any): number | null => {
          const value = cell.value;
          
          // Null/undefined/empty = leave unchanged (for headers)
          if (value === null || value === undefined || value === '') return null;
          
          if (typeof value === 'string') {
            const trimmed = value.trim().toLowerCase();
            
            // Handle text status values
            if (trimmed === 'completed' || trimmed === 'complete' || trimmed === 'done') {
              return 100;
            }
            if (trimmed === 'incomplete' || trimmed === 'pending' || trimmed === 'not started') {
              return 0;
            }
            
            // Also support legacy percentage format for backwards compatibility
            const cleanValue = value.trim().replace('%', '');
            const num = parseFloat(cleanValue);
            if (!isNaN(num)) {
              // If parsed value is <= 1, treat as decimal
              if (num >= 0 && num <= 1) {
                return Math.round(num * 100);
              }
              return Math.min(100, Math.max(0, Math.round(num)));
            }
          }
          
          if (typeof value === 'number') {
            // Excel stores percentages as decimals (0.75 = 75%)
            // If value is <= 1, it's likely a decimal percentage
            if (value >= 0 && value <= 1) {
              return Math.round(value * 100);
            }
            // If value is > 1, it's already in 0-100 format
            return Math.min(100, Math.max(0, Math.round(value)));
          }
          
          return null;
        };
        
        const startDate = parseExcelDate(startDateCell);
        const endDate = parseExcelDate(endDateCell);
        const progressPercentage = parseProgress(progressCell);
        const remarks = remarksCell.value?.toString() || null;
        
        // Build changes object - only include fields that have valid values
        const changes: any = {};
        if (startDate) changes.startDate = startDate;
        if (endDate) changes.endDate = endDate;
        if (progressPercentage !== null) changes.progressPercentage = progressPercentage;
        if (remarks !== null) changes.remarks = remarks;
        
        // Only add update if there are actual changes
        if (Object.keys(changes).length > 0) {
          updates.push({ id: dbId, changes });
        }
      });
      
      if (errors.length > 0 && updates.length === 0) {
        return res.status(400).json({ error: "Re-import failed", details: errors });
      }
      
      // Apply updates
      let successCount = 0;
      let failCount = 0;
      
      for (const update of updates) {
        try {
          await storage.updateTask(update.id, update.changes);
          successCount++;
        } catch (err) {
          console.error(`Failed to update task ${update.id}:`, err);
          failCount++;
        }
      }
      
      // Log the activity
      const user = req.user as any;
      const userName = user?.claims?.first_name && user?.claims?.last_name 
        ? `${user.claims.first_name} ${user.claims.last_name}` 
        : user?.claims?.email || 'Unknown';
      
      await storage.createActivity({
        userId,
        userName: userName,
        userEmail: user?.claims?.email || '',
        activityType: 'schedule_reimport' as any,
        fileName: schedule.originalFilename || 'schedule',
        description: `re-imported Designer Export: ${successCount} tasks updated, ${failCount} failed`,
        metadata: { scheduleId, successCount, failCount },
      });
      
      res.json({
        success: true,
        message: `Successfully updated ${successCount} tasks`,
        updated: successCount,
        failed: failCount,
        errors: errors.length > 0 ? errors : undefined,
      });
      
    } catch (error) {
      console.error('Error re-importing designer export:', error);
      res.status(500).json({ error: "Failed to re-import designer export" });
    }
  });

  // Task Dependencies
  app.get("/api/task-dependencies/:taskId", requireAuth, async (req, res) => {
    try {
      const { taskId } = req.params;
      const dependencies = await storage.getTaskDependencies(taskId);
      res.json(dependencies);
    } catch (error) {
      console.error('Error fetching dependencies:', error);
      res.status(500).json({ error: "Failed to fetch dependencies" });
    }
  });

  // Note: Dependencies feature is currently disabled - focusing on task alerts instead
  // Keeping basic endpoint for future use
  app.post("/api/task-dependencies", requireAuth, async (req, res) => {
    try {
      const validatedData = insertTaskDependencySchema.parse(req.body);
      
      // Basic validation: no self-reference
      if (validatedData.fromTaskId === validatedData.toTaskId) {
        return res.status(400).json({ 
          error: "Invalid dependency: A task cannot depend on itself" 
        });
      }
      
      const dependency = await storage.createTaskDependency(validatedData);
      res.status(201).json(dependency);
    } catch (error) {
      console.error('Error creating dependency:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid dependency data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create dependency" });
    }
  });

  app.delete("/api/task-dependencies/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTaskDependency(id);
      if (!deleted) {
        return res.status(404).json({ error: "Dependency not found" });
      }
      res.json({ message: "Dependency deleted successfully" });
    } catch (error) {
      console.error('Error deleting dependency:', error);
      res.status(500).json({ error: "Failed to delete dependency" });
    }
  });

  // Critical Path Calculation
  app.get("/api/schedules/:scheduleId/critical-path", requireAuth, async (req, res) => {
    try {
      const { scheduleId } = req.params;
      
      // Import the CPM calculator
      const { calculateCriticalPath } = await import('./criticalPath');
      
      // Get all tasks for this schedule
      const scheduleTasks = await storage.getTasksBySchedule(scheduleId);
      
      if (scheduleTasks.length === 0) {
        return res.json({
          tasks: [],
          criticalPath: [],
          projectDuration: 0,
          criticalPathDuration: 0
        });
      }
      
      // Get all dependencies for these tasks
      const taskIds = scheduleTasks.map(t => t.id);
      const allDependencies = await Promise.all(
        taskIds.map(id => storage.getTaskDependencies(id))
      );
      const dependencies = allDependencies.flat();
      
      // Calculate critical path
      const result = calculateCriticalPath(scheduleTasks, dependencies);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error calculating critical path:', error);
      // Check if it's a circular dependency error
      if (error?.message?.includes('Circular dependency')) {
        return res.status(400).json({ 
          error: error.message,
          type: 'circular_dependency' 
        });
      }
      res.status(500).json({ error: "Failed to calculate critical path" });
    }
  });

  // Calculate critical path for a project (all schedules)
  app.get("/api/projects/:projectId/critical-path", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // Import the CPM calculator
      const { calculateCriticalPath } = await import('./criticalPath');
      
      // Get all tasks for this project
      const projectTasks = await storage.getTasksByProject(projectId);
      
      if (projectTasks.length === 0) {
        return res.json({
          tasks: [],
          criticalPath: [],
          projectDuration: 0,
          criticalPathDuration: 0
        });
      }
      
      // Get all dependencies for these tasks
      const taskIds = projectTasks.map(t => t.id);
      const allDependencies = await Promise.all(
        taskIds.map(id => storage.getTaskDependencies(id))
      );
      const dependencies = allDependencies.flat();
      
      // Calculate critical path
      const result = calculateCriticalPath(projectTasks, dependencies);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error calculating critical path:', error);
      // Check if it's a circular dependency error
      if (error?.message?.includes('Circular dependency')) {
        return res.status(400).json({ 
          error: error.message,
          type: 'circular_dependency' 
        });
      }
      res.status(500).json({ error: "Failed to calculate critical path" });
    }
  });

  // Task Alerts
  app.get("/api/task-alerts/user/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const alerts = await storage.getTaskAlertsByUser(userId);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.post("/api/task-alerts", requireAuth, async (req, res) => {
    try {
      const validatedData = insertTaskAlertSchema.parse(req.body);
      const alert = await storage.createTaskAlert(validatedData);
      res.status(201).json(alert);
    } catch (error) {
      console.error('Error creating alert:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid alert data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  app.put("/api/task-alerts/:id/read", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const alert = await storage.markAlertAsRead(id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error('Error marking alert as read:', error);
      res.status(500).json({ error: "Failed to mark alert as read" });
    }
  });

  // Approvals
  app.get("/api/approvals/task/:taskId", requireAuth, async (req, res) => {
    try {
      const { taskId } = req.params;
      const approvals = await storage.getApprovalsByTask(taskId);
      res.json(approvals);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      res.status(500).json({ error: "Failed to fetch approvals" });
    }
  });

  app.post("/api/approvals", requireAuth, async (req, res) => {
    try {
      const validatedData = insertApprovalSchema.parse(req.body);
      const approval = await storage.createApproval(validatedData);
      res.status(201).json(approval);
    } catch (error) {
      console.error('Error creating approval:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid approval data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create approval" });
    }
  });

  app.put("/api/approvals/:id/resolve", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, comments } = req.body;
      
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
      }

      const approval = await storage.resolveApproval(id, status, comments);
      if (!approval) {
        return res.status(404).json({ error: "Approval not found" });
      }
      res.json(approval);
    } catch (error) {
      console.error('Error resolving approval:', error);
      res.status(500).json({ error: "Failed to resolve approval" });
    }
  });

  // Activity Log - Get recent activities
  app.get("/api/activities", requireAuth, async (req, res) => {
    try {
      const { limit = '20', projectId } = req.query;
      const limitNum = parseInt(limit as string, 10);
      
      const activities = await storage.getRecentActivities(
        limitNum, 
        projectId as string | undefined
      );
      
      res.json(activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // Vendor Invoices Routes
  app.get("/api/vendors/:vendorId/invoices", requireAuth, async (req, res) => {
    try {
      const { vendorId } = req.params;
      const invoices = await storage.getVendorInvoices(vendorId);
      res.json(invoices);
    } catch (error) {
      console.error('Error fetching vendor invoices:', error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/vendors/:vendorId/invoices", requireAdmin, async (req, res) => {
    try {
      const { vendorId } = req.params;
      const userId = (req.user as any).claims.sub;
      
      const invoiceData = insertVendorInvoiceSchema.parse({
        ...req.body,
        vendorId,
        createdBy: userId,
      });
      
      const invoice = await storage.createVendorInvoice(invoiceData);
      
      // Log activity
      const user = await storage.getUser(userId);
      const vendor = await storage.getVendor(vendorId);
      if (user && vendor) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'invoice_create',
            fileName: invoice.invoiceNumber || 'Invoice',
            description: `created invoice ${invoice.invoiceNumber} for ${vendor.name} - Amount: ₹${invoice.amount}`,
            metadata: {
              invoiceId: invoice.id,
              vendorId: vendor.id,
              vendorName: vendor.name,
              amount: invoice.amount,
              invoiceNumber: invoice.invoiceNumber
            }
          });
        } catch (activityError) {
          console.error('Error logging invoice creation activity:', activityError);
        }
      }
      
      res.status(201).json(invoice);
    } catch (error) {
      console.error('Error creating vendor invoice:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid invoice data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.put("/api/invoices/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any).claims.sub;
      
      // Omit createdBy and vendorId from updates to prevent tampering
      const updates = insertVendorInvoiceSchema.omit({ createdBy: true, vendorId: true }).partial().parse(req.body);
      
      const invoice = await storage.updateVendorInvoice(id, updates);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      // Log activity
      const user = await storage.getUser(userId);
      const vendor = await storage.getVendor(invoice.vendorId);
      if (user && vendor) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'invoice_update',
            fileName: invoice.invoiceNumber || 'Invoice',
            description: `updated invoice ${invoice.invoiceNumber} for ${vendor.name}`,
            metadata: {
              invoiceId: invoice.id,
              vendorId: vendor.id,
              vendorName: vendor.name,
              amount: invoice.amount,
              invoiceNumber: invoice.invoiceNumber
            }
          });
        } catch (activityError) {
          console.error('Error logging invoice update activity:', activityError);
        }
      }
      
      res.json(invoice);
    } catch (error) {
      console.error('Error updating vendor invoice:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid invoice data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any).claims.sub;
      
      // Get invoice details before deleting
      const invoice = await storage.getVendorInvoice(id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const deleted = await storage.deleteVendorInvoice(id);
      if (!deleted) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      // Log activity
      const user = await storage.getUser(userId);
      const vendor = await storage.getVendor(invoice.vendorId);
      if (user && vendor) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'invoice_delete',
            fileName: invoice.invoiceNumber || 'Invoice',
            description: `deleted invoice ${invoice.invoiceNumber} for ${vendor.name}`,
            metadata: {
              invoiceId: invoice.id,
              vendorId: vendor.id,
              vendorName: vendor.name,
              amount: invoice.amount,
              invoiceNumber: invoice.invoiceNumber
            }
          });
        } catch (activityError) {
          console.error('Error logging invoice delete activity:', activityError);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting vendor invoice:', error);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  // Vendor Payments Routes
  app.get("/api/vendors/:vendorId/payments", requireAuth, async (req, res) => {
    try {
      const { vendorId } = req.params;
      const payments = await storage.getVendorPayments(vendorId);
      res.json(payments);
    } catch (error) {
      console.error('Error fetching vendor payments:', error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.get("/api/payments/all", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getAllPaymentsWithVendors();
      res.json(payments);
    } catch (error) {
      console.error('Error fetching all payments:', error);
      res.status(500).json({ error: "Failed to fetch all payments" });
    }
  });

  app.post("/api/vendors/:vendorId/payments", requireAdmin, async (req, res) => {
    try {
      const { vendorId } = req.params;
      const userId = (req.user as any).claims.sub;
      
      const paymentData = insertVendorPaymentSchema.parse({
        ...req.body,
        vendorId,
        createdBy: userId,
      });
      
      const payment = await storage.createVendorPayment(paymentData);

      // Log activity
      const user = await storage.getUser(userId);
      const vendor = await storage.getVendor(vendorId);
      if (user && vendor) {
        try {
          await storage.createActivityLog({
            userId: userId,
            userName: user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.email || 'Unknown User',
            userEmail: user.email || '',
            projectId: paymentData.projectId || null,
            activityType: 'vendor_payment',
            fileName: `Payment to ${vendor.name}`,
            description: `Payment of ₹${paymentData.amount} to ${vendor.name}`,
            metadata: {
              paymentId: payment.id,
              vendorId: vendorId,
              vendorName: vendor.name,
              amount: paymentData.amount,
              paymentMethod: paymentData.paymentMethod,
              paymentDate: paymentData.paymentDate,
            },
          });
        } catch (activityError) {
          console.error('Error logging payment activity:', activityError);
        }
      }

      res.status(201).json(payment);
    } catch (error) {
      console.error('Error creating vendor payment:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid payment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.put("/api/payments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Omit createdBy and vendorId from updates to prevent tampering
      const updates = insertVendorPaymentSchema.omit({ createdBy: true, vendorId: true }).partial().parse(req.body);
      
      const payment = await storage.updateVendorPayment(id, updates);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      console.error('Error updating vendor payment:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid payment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update payment" });
    }
  });

  app.delete("/api/payments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteVendorPayment(id);
      if (!deleted) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting vendor payment:', error);
      res.status(500).json({ error: "Failed to delete payment" });
    }
  });

  // Configure multer for invoice PDF uploads (using memoryStorage for object storage)
  const invoiceUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit for invoice PDFs
      files: 1,
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['application/pdf'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(file.mimetype) || fileExtension === '.pdf') {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF files are allowed for invoice attachments.'));
      }
    }
  });

  // Generic file upload endpoint for invoice PDFs
  app.post("/api/upload", requireAdmin, invoiceUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = (req.user as any).claims.sub;
      
      // Upload file to object storage
      const objectPath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      );

      res.json({ path: objectPath });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Configure multer for catalogue file uploads (using memoryStorage for object storage)
  const catalogueUpload = multer({
    storage: multer.memoryStorage(), // Store in memory, then upload to object storage
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit for catalogue files
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
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      ];
      
      // Also check file extension as MIME types can be unreliable
      const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.xlsx', '.docx'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, images (PNG, JPG, GIF, BMP, TIFF), Excel, and Word files are allowed.'));
      }
    }
  });

  // Generate signed URL for direct catalogue file upload
  app.post("/api/catalogue/upload-url", requireAdmin, async (req, res) => {
    try {
      const { fileName, fileType } = req.body;
      
      if (!fileName) {
        return res.status(400).json({ error: "fileName is required" });
      }

      const userId = (req.user as any).claims.sub;
      const objectId = randomUUID();
      const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
      
      if (!privateObjectDir) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      // Create object path
      const objectPath = `${privateObjectDir}/uploads/${objectId}`;
      const { bucketName, objectName } = parseObjectPath(objectPath);

      // Generate signed URL for upload
      const signedUrl = await signObjectURL({
        bucketName,
        objectName,
        method: 'PUT',
        ttlSec: 900, // 15 minutes
      });

      res.json({
        uploadUrl: signedUrl,
        objectPath: `/objects/uploads/${objectId}`,
        fileName,
        userId, // Send userId back so client can set ACL
      });
    } catch (error) {
      console.error('Error generating upload URL:', error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Set ACL after direct upload
  app.post("/api/catalogue/set-acl", requireAdmin, async (req, res) => {
    try {
      const { objectPath, userId } = req.body;
      
      if (!objectPath || !userId) {
        return res.status(400).json({ error: "objectPath and userId are required" });
      }

      const objectStorageService = new ObjectStorageService();
      
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        await objectStorageService.trySetObjectEntityAclPolicy(
          objectPath,
          {
            owner: userId,
            visibility: "private",
          }
        );
        res.json({ success: true });
      } catch (error) {
        console.error('Error setting ACL policy:', error);
        res.status(500).json({ error: "Failed to set ACL policy" });
      }
    } catch (error) {
      console.error('Error in set-acl endpoint:', error);
      res.status(500).json({ error: "Failed to set ACL" });
    }
  });

  // Catalogue Routes - Admin/Designer only
  app.get("/api/catalogue", requireAdmin, async (req, res) => {
    try {
      const { mainCategory, subcategory } = req.query;
      const items = await storage.getCatalogueItemsByCategory(
        mainCategory as string | undefined,
        subcategory as string | undefined
      );
      res.json(items);
    } catch (error) {
      console.error('Error fetching catalogue items:', error);
      res.status(500).json({ error: "Failed to fetch catalogue items" });
    }
  });

  app.get("/api/catalogue/categories", requireAdmin, async (req, res) => {
    try {
      const categories = await storage.getMainCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Admin endpoint to populate catalogue with initial data
  app.post("/api/catalogue/populate", requireAdmin, async (req, res) => {
    try {
      const currentCount = await storage.getCatalogueItemsCount();
      if (currentCount > 0) {
        return res.status(400).json({ 
          error: "Catalogue already has data", 
          currentCount 
        });
      }

      // All 99 catalogue items seed data
      const seedData = [
        ["77336b8a-8132-4d37-8afd-065b6ed1bf4a", "Acoustics", "Panels & Baffles", null, null, "NRC, material, mounting"],
        ["2b56184b-12db-43b9-9e35-c4fc8beb96ee", "Acoustics", "Underlays & Doors", null, null, "Rw/STC ratings, thickness"],
        ["e6c82a02-aa15-44c1-83af-83e907a7890a", "Appliances", "Cooking (Ovens/Hobs/Hoods)", null, null, "Fuel/electric, zones/burners, width, extraction"],
        ["bfa397a5-8475-4745-b3e9-4a6e93eaa623", "Appliances", "Dishwashers", null, null, "Place settings, noise, panel-ready"],
        ["a3265f1a-e992-43d2-bc29-16e9c7e11beb", "Appliances", "Laundry (Washer/Dryer)", null, null, "Capacity, heat-pump, stackable"],
        ["7bcf1fb6-a07d-40cc-bee7-adb86223fac5", "Appliances", "Microwaves & Steam Ovens", null, null, "Built-in/freestanding, capacity, features"],
        ["3fa35d62-c8b2-4991-ac66-1b9a36b43df1", "Appliances", "Refrigeration", null, null, "Type, capacity, finish, energy rating"],
        ["d241ddc7-378d-49d0-a1b3-9e72a9ec6578", "Appliances", "Small Appliances (Kitchen)", null, null, "Toaster, mixer, coffee, blender"],
        ["57c5bb5b-8893-4a4b-901d-04e85a8a9ed7", "Art", "Artist", null, null, "Style, medium, size, framing, subject matter"],
        ["b45d6994-912c-40a9-b135-7a1ef29baa64", "Bathroom Fittings", "Accessories", null, null, "Towel rails, holders, shelves, mirrors"],
        ["afe66b35-5fff-438e-84be-385020302634", "Bathroom Fittings", "Bathtubs & Spas", null, null, "Freestanding, inset, size, material"],
        ["31e67303-5f13-47e7-997b-c02e70ca8727", "Bathroom Fittings", "Faucets & Mixers", null, null, "Basin, bath, shower mixers; finish; flow"],
        ["e22a6997-588e-4fe9-8ff6-3ae80c30a997", "Bathroom Fittings", "Sanitaryware", null, null, "WCs (wall/floor), basins, bidets"],
        ["b99509e0-edd6-4349-95e2-789ad7c62139", "Bathroom Fittings", "Shower Enclosures", null, null, "Framed/semi/frameless, glass thickness, finish"],
        ["331a9c39-2694-403c-a88d-c6c4341dff93", "Bathroom Fittings", "Showers & Systems", null, null, "Handshower, rain, thermostatic, body jets"],
        ["61a82b80-279d-4984-a622-cfa824a1769a", "Bathroom Fittings", "Vanities & Storage", null, null, "Widths, tops, basins, soft-close"],
        ["d3bfaf59-b3c4-49b9-8177-d5d6b5fcfdbc", "Bathroom Fittings", "Water Heaters", null, null, "Instant/storage, capacity, energy rating"],
        ["fda59e02-4523-4242-8d43-757be9c6b3c3", "Doors & Windows", "External Doors", null, null, "Weather rating, security hardware"],
        ["3926225e-5a5e-4d76-835d-d9cbcafb2498", "Doors & Windows", "Hardware", null, null, "Hinges, locks, handles, closers"],
        ["af0d74ea-6439-4401-b640-544603a83ee4", "Doors & Windows", "Internal Doors", null, null, "Solid/engineered, fire rating, finish"],
        ["ccd50133-786c-47f3-a467-25601a7fa276", "Doors & Windows", "Skylights & Roof Windows", null, null, "Fixed/vented, flashing kits"],
        ["e724a68f-c19b-4fce-a2fd-7181cf1defea", "Doors & Windows", "Windows & Glazing", null, null, "uPVC/aluminium, glazing type, U-value"],
        ["d243d07a-d4ab-4129-8f93-e312f8a9f023", "Décor", "Artwork & Prints", null, null, "Framing, size, mounting"],
        ["1312f2b2-b98d-4af6-8309-70bdc4865f94", "Décor", "Mirrors", null, null, "Framed/frameless, bevel, LED"],
        ["8b4e95ce-bec9-4f28-bdc7-75150691c673", "Décor", "Vases & Accessories", null, null, "Material, size, finish"],
        ["031499d8-20ec-4dd7-979e-71a63ca98ddb", "Electricals", "Audio/Video & Networking", null, null, "In-wall speakers, racks, Wi‑Fi, cabling"],
        ["d06f92ee-9178-4632-be38-ad7a31816c2f", "Electricals", "Distribution Boards & MCBs", null, null, "Load, poles, brands"],
        ["eebecc82-f215-4e3d-9aef-0e61f571929d", "Electricals", "Home Automation", null, null, "Hubs, sensors, relays, scenes"],
        ["311bb5f5-0011-4a78-860b-7915b6f078e3", "Electricals", "Smart Shades/Blinds", null, null, "Motor type, control, fabric"],
        ["7104e94c-fa74-468b-9352-a665e9cd6a8e", "Electricals", "Switches & Sockets", null, null, "Modular systems, finishes, smart options"],
        ["e110a636-da82-4a58-a00c-2892efac3fcf", "Electricals", "Wiring Devices & Conduit", null, null, "Ratings, colors, accessories"],
        ["01134602-5b4d-4706-808f-e6a8056db025", "Furniture", "Armchairs & Accent Chairs", null, null, "Style, upholstery, swivel/recliner, legs material"],
        ["bffdf429-0970-45c1-9859-43005560277a", "Furniture", "Beds", null, null, "Size, headboard type, storage, frame material"],
        ["a9c2fed1-e7b8-431d-8cc6-f380c5e0d5d0", "Furniture", "Bookshelves & Cabinets", null, null, "Open/closed, glass doors, modular"],
        ["7586e747-6e36-4a93-9812-7dded98d946a", "Furniture", "Dining Chairs & Benches", null, null, "Upholstered, stackable, arm/no-arm, outdoor-rated"],
        ["a89021e7-97a0-4def-b5fc-8c583c643f76", "Furniture", "Dining Tables", null, null, "Shape, seats, top material, base, extendable"],
        ["b73657bf-89ea-4a30-8507-1fd5e744c9ef", "Furniture", "Dressers & Consoles", null, null, "Drawers, handles, finish, legs"],
        ["09626ee0-867d-4550-9fab-e27d3a68a670", "Furniture", "Kids Furniture", null, null, "Safety edges, storage, adjustable sizes"],
        ["65381744-d66e-40b9-93fa-6cb72cc5dfcc", "Furniture", "Mattresses", null, null, "Size, type (foam/spring/latex), firmness"],
        ["36d66d0e-b4e2-4b6f-9676-fc478f8f0296", "Furniture", "Outdoor Furniture", null, null, "Weather rating, frames, cushions, stackable"],
        ["3c1bc334-53e3-47a6-a1fb-4820a40d53d2", "Furniture", "Side/Center Tables", null, null, "Shape, top material, nesting, storage"],
        ["c541db1a-b429-4704-8970-443785f9fe02", "Furniture", "Sofas & Sectionals", null, null, "Style, seats, fabric/leather, modular, recliner, dimensions"],
        ["f752a5bf-2583-4459-a259-d7440256e7dd", "Furniture", "TV Units & Media Consoles", null, null, "Width, cable mgmt, wall/floor mounted"],
        ["55159ede-c78b-4d24-a9a7-5cdfa2ad2868", "Furniture", "Wardrobes & Closets", null, null, "Hinged/slider, carcass material, finishes, internals"],
        ["e656d5d6-31ad-4f58-9d2b-30c1de8d2df6", "HVAC", "AC Units", null, null, "Split/cassette/ducted, capacity, efficiency, noise"],
        ["6236287e-4664-49d1-93bc-244d0b54aa22", "HVAC", "Thermostats & Controls", null, null, "Programmable, smart, protocols"],
        ["590d4cdd-aed8-4748-acc7-17c7c7a665f1", "HVAC", "Ventilation & Exhaust", null, null, "CFM, duct sizes, silencers"],
        ["5808525e-7974-4e24-b371-fdc1b4239dc2", "Joinery", "Adhesives & Sealants", null, null, "PU, PVA, epoxy, silicone"],
        ["d8037a6d-cdcc-4541-b97a-48f09a81b331", "Joinery", "Boards & Panels", null, null, "Plywood grades, MDF/HDHMR, compact laminate"],
        ["3acc2410-a2a9-4425-a5f4-94f25f73694e", "Joinery", "Edgebanding & Profiles", null, null, "Material, thickness, colors"],
        ["acc5e071-a9af-4486-87c9-3f12830f6684", "Joinery", "Fasteners & Fittings", null, null, "Screws, inserts, brackets"],
        ["2f10269e-1452-4ae5-998b-2b9344de92fb", "Joinery", "Veneers & Laminates", null, null, "Species, thickness, finish"],
        ["b911a655-79a5-4166-97f9-5cf3410b8389", "Kitchens", "Backsplash & Wall Panels", null, null, "Tile, glass, quartz, compact laminate"],
        ["0dc5d844-7fa8-4bf8-803a-5e25539257c0", "Kitchens", "Cabinet Hardware", null, null, "Hinges, drawer systems, lifters, soft-close"],
        ["a0015009-eb91-4b97-8714-0dc3a7ec76d0", "Kitchens", "Countertops", null, null, "Quartz/granite/solid-surface, thickness, edge"],
        ["832ed086-3d4b-43ee-b529-9003c0fa8c02", "Kitchens", "Faucets (Kitchen)", null, null, "Pull-out, filtration, finish, flow rate"],
        ["1b4a4a43-66d2-454f-9c4a-f58890d17ef1", "Kitchens", "Modular Kitchen Systems", null, null, "Layout, modules, carcass, shutter finish"],
        ["a3cdd742-1a41-4cf9-a3d6-d6a5ae2965ad", "Kitchens", "Sinks", null, null, "Bowl config, mount type, material, drainers"],
        ["bbb896ff-d0ba-4187-b342-779c9e195be0", "Kitchens", "Storage Accessories", null, null, "Corner units, pull-outs, spice racks, bins"],
        ["6e967bd3-fbd7-42c8-bea2-b27ab4759fb7", "Lighting", "Ceiling Lights", null, null, "Flush/semi-flush, lumen, CCT, dimmable"],
        ["f344cb79-0364-4ab4-b57e-8eb5afcde3d1", "Lighting", "Downlights", null, null, "Cutout, beam angle, CRI, CCT, trim color"],
        ["c0601f52-121b-4705-a4cb-1d2de4b78bab", "Lighting", "Exterior Lighting", null, null, "IP, IK, bollards, facade washers"],
        ["6206644d-9477-47c1-af62-6276aa792738", "Lighting", "Floor & Table Lamps", null, null, "Switch type, shade, dimmer, smart"],
        ["636dc77b-f283-4578-a84c-ab0faff6a6a2", "Lighting", "Pendants & Chandeliers", null, null, "Height adjustable, diameter, sockets"],
        ["a78406ec-dd75-49cc-b3a2-0564b8eae746", "Lighting", "Smart Lighting Controls", null, null, "DALI, 0-10V, Casambi, Zigbee"],
        ["c6aade37-2010-4935-9fd0-e00a284ca759", "Lighting", "Track & Linear Systems", null, null, "Track type, heads, drivers, controls"],
        ["9ea8fa11-d677-49d8-820a-13f4a26f47c1", "Lighting", "Wall Lights", null, null, "IP rating, up/down, reading/ambient"],
        ["586a32b4-be0e-4aa5-b4a6-0b2dd868452d", "Outdoor", "Decking & Pavers", null, null, "Material, slip rating, thickness"],
        ["4cbc45dd-91f0-4a9a-bd39-5a68930fda32", "Outdoor", "Fencing & Screens", null, null, "Material, height, privacy"],
        ["a70f49f8-fb6d-4b1d-bb26-9ada9ecb9e31", "Outdoor", "Green Walls & Planters", null, null, "Irrigation, substrate, sizes"],
        ["6b499c52-adff-484f-b63b-4b98640542e0", "Outdoor", "Outdoor Kitchens & BBQ", null, null, "Modules, fuel, countertops"],
        ["421fbb37-fc3a-4f6b-9de4-63433fbec246", "Outdoor", "Pergolas & Gazebos", null, null, "Material, span, roofing"],
        ["a6d80728-f549-4f26-b00d-722dc0e6b786", "Outdoor", "Pools & Spas (Residential)", null, null, "Shell type, finish, equipment"],
        ["e08e405b-4e09-4dcc-ae05-5a6a9e8d52aa", "Plumbing", "Pipes & Fittings", null, null, "CPVC/PPR/PEX, diameters, SDR"],
        ["807f2f6a-1f61-4069-bf56-1c9579d3bee9", "Plumbing", "Valves & Traps", null, null, "Type, size, material, ratings"],
        ["6a429186-cd88-4599-90a6-2452c19780d4", "Plumbing", "Water Treatment", null, null, "RO, softeners, UV, filters"],
        ["47746614-91d7-4800-9fa4-41ba8ad7ed6c", "Security & Safety", "Detectors & Extinguishers", null, null, "Type, standards, mounting"],
        ["2cb10009-aca9-4262-8244-219e29c73eec", "Security & Safety", "Video Door Phones & Locks", null, null, "Connectivity, power, certifications"],
        ["da2279dd-1dab-4605-b22f-5dbdc133126a", "Signage & Wayfinding", "Numbers & Plaques", null, null, "Material, size, mounting"],
        ["607ff829-6c77-4c72-b850-a80ff4e51095", "Soft Furnishings", "Bedding & Linen", null, null, "Thread count, material, sizes"],
        ["be1f1045-4577-466a-b069-cd94c6871710", "Soft Furnishings", "Blinds & Shades", null, null, "Roller/roman/venetian, blackout, motorized"],
        ["a70dec28-f8e1-4c1f-9cea-5fa965f6e4cb", "Soft Furnishings", "Curtains & Drapes", null, null, "Header style, fabric, lining, track"],
        ["2353780c-6171-43d8-8d1f-92850be33b5b", "Soft Furnishings", "Cushions & Throws", null, null, "Fill, size, fabric"],
        ["6b3b02be-1434-4340-9fd1-0c8171b97ab4", "Storage", "Garage/Utility Storage", null, null, "Shelving, cabinets, racks"],
        ["0dd035e2-103e-4547-aba2-eff143ea14e3", "Storage", "Kitchen Internals", null, null, "Cutlery trays, bottle pull-outs, bins"],
        ["3a06cdf7-534b-47de-92f7-b9f03541d4ac", "Storage", "Wardrobe Internals", null, null, "Rails, drawers, pull-outs, lighting"],
        ["90b4e979-2fb5-42bd-be2d-2d9329bf06d9", "Surfaces", "Carpets & Rugs", null, null, "Pile type, fiber, backing"],
        ["3b6315be-94f1-4d3e-a62c-d34495a49323", "Surfaces", "Countertops (Bath/Vanity)", null, null, "Material, thickness, edge"],
        ["7d6d1120-010f-4056-b2f0-7bdd36612e9c", "Surfaces", "Flooring (Tiles/Stone/Wood)", null, null, "Material, size, finish, slip rating"],
        ["f997931f-93a4-474b-a66f-33adee0bd592", "Surfaces", "Vinyl/LVT/Laminate", null, null, "Wear layer, click/glue, waterproof"],
        ["c6510151-482d-49b9-ac98-84ba3685a066", "Surfaces", "Wall Tiles & Cladding", null, null, "Material, size, texture, grout"],
        ["39e9a364-64fe-4eaf-b422-9555d120ec48", "Surfaces", "Wood & Engineered Floors", null, null, "Species, plank size, finish, installation"],
        ["5408a528-70de-4301-bab1-0225fc56ceb0", "Walls & Ceilings", "Cornices & Mouldings", null, null, "Profiles, materials, lengths"],
        ["8297224c-e1c7-4748-9a35-c0b766f6acbb", "Walls & Ceilings", "False Ceilings", null, null, "Gypsum/metal/wood, access panels"],
        ["3cf124a7-0ab3-4147-9568-293f51a19389", "Walls & Ceilings", "Paints & Primers", null, null, "Finish, VOC, washability, shade codes"],
        ["0c28516b-8b8c-4ac8-b975-ffe9964d65f0", "Walls & Ceilings", "Wall Panels", null, null, "MDF/PU/laminate, slatted, acoustic"],
        ["44abc48d-a3d4-428c-9304-550bacc993bd", "Walls & Ceilings", "Wallpapers", null, null, "Type, repeat, backing, washability"],
        ["b56e3cd2-074e-409f-92b2-32bf47b6d9e3", "Workspaces", "Ergonomics", null, null, "Monitor arms, mats, cable mgmt"],
        ["b7ba1872-edac-47b0-b473-fd28739cd40f", "Workspaces", "Office Furniture", null, null, "Desks, task chairs, storage"]
      ];

      let inserted = 0;
      for (const [id, mainCategory, subcategory, vendorBrand, description, attributes] of seedData) {
        await storage.createCatalogueItemWithId({
          id: id as string,
          mainCategory: mainCategory as string,
          subcategory: subcategory as string,
          vendorBrand: vendorBrand as string | undefined,
          description: description as string | undefined,
          attributes: attributes as string
        });
        inserted++;
      }

      const finalCount = await storage.getCatalogueItemsCount();
      res.json({ 
        message: "Catalogue populated successfully", 
        inserted,
        totalItems: finalCount 
      });
    } catch (error) {
      console.error('Error populating catalogue:', error);
      res.status(500).json({ error: "Failed to populate catalogue" });
    }
  });

  app.post("/api/catalogue", requireAdmin, async (req, res) => {
    try {
      const itemData: any = {
        mainCategory: req.body.mainCategory,
        subcategory: req.body.subcategory,
        attributes: req.body.attributes || '' // Allow empty attributes
      };

      if (!itemData.mainCategory || !itemData.subcategory) {
        return res.status(400).json({ error: "Main category and subcategory are required" });
      }

      if (req.body.vendorBrand) itemData.vendorBrand = req.body.vendorBrand;
      if (req.body.description) itemData.description = req.body.description;
      if (req.body.catalogueUrl) itemData.catalogueUrl = req.body.catalogueUrl;
      
      // If file metadata was provided (from direct upload), use it
      if (req.body.filePath && req.body.fileName) {
        itemData.filePath = req.body.filePath;
        itemData.fileName = req.body.fileName;
      }

      const validatedData = insertCatalogueItemSchema.parse(itemData);
      const item = await storage.createCatalogueItem(validatedData);
      
      // Log activity
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        const displayName = `${item.mainCategory} > ${item.subcategory}${item.vendorBrand ? ` (${item.vendorBrand})` : ''}`;
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email,
          activityType: 'catalogue_upload',
          fileName: displayName,
          filePath: item.filePath || undefined,
          description: `uploaded catalogue item "${displayName}"`,
          metadata: { catalogueItemId: item.id }
        });
      }
      
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating catalogue item:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid catalogue item data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create catalogue item" });
    }
  });

  app.put("/api/catalogue/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates: any = {};
      
      // Parse fields from JSON body
      if (req.body.mainCategory) updates.mainCategory = req.body.mainCategory;
      if (req.body.subcategory) updates.subcategory = req.body.subcategory;
      if (req.body.vendorBrand !== undefined) updates.vendorBrand = req.body.vendorBrand;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.catalogueUrl !== undefined) updates.catalogueUrl = req.body.catalogueUrl;
      if (req.body.attributes) updates.attributes = req.body.attributes;
      
      // If file metadata was provided (from direct upload), use it
      if (req.body.filePath && req.body.fileName) {
        updates.fileName = req.body.fileName;
        updates.filePath = req.body.filePath;
      }
      
      const validatedUpdates = insertCatalogueItemSchema.partial().parse(updates);
      const item = await storage.updateCatalogueItem(id, validatedUpdates);
      if (!item) {
        return res.status(404).json({ error: "Catalogue item not found" });
      }
      
      // Log activity
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        const displayName = `${item.mainCategory} > ${item.subcategory}${item.vendorBrand ? ` (${item.vendorBrand})` : ''}`;
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email,
          activityType: 'catalogue_update',
          fileName: displayName,
          filePath: item.filePath || undefined,
          description: `updated catalogue item "${displayName}"`,
          metadata: { catalogueItemId: item.id }
        });
      }
      
      res.json(item);
    } catch (error) {
      console.error('Error updating catalogue item:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid catalogue item data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update catalogue item" });
    }
  });

  app.delete("/api/catalogue/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Fetch the item details before deleting for activity logging
      const item = await storage.getCatalogueItem(id);
      
      const deleted = await storage.deleteCatalogueItem(id);
      if (!deleted) {
        return res.status(404).json({ error: "Catalogue item not found" });
      }
      
      // Log the deletion activity
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (item && user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        const displayName = `${item.mainCategory} > ${item.subcategory}${item.vendorBrand ? ` (${item.vendorBrand})` : ''}`;
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email,
          activityType: 'catalogue_delete',
          fileName: displayName,
          filePath: item.filePath || undefined,
          description: `deleted catalogue item "${displayName}"`,
          metadata: { catalogueItemId: item.id }
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting catalogue item:', error);
      res.status(500).json({ error: "Failed to delete catalogue item" });
    }
  });

  // Configure multer for specifications file uploads
  const specificationsUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
  });

  // Specifications Routes - Admin/Designer only
  app.get("/api/specifications", requireAdmin, async (req, res) => {
    try {
      const { category } = req.query;
      const specs = category 
        ? await storage.getSpecificationsByCategory(category as string)
        : await storage.getAllSpecifications();
      res.json(specs);
    } catch (error) {
      console.error('Error fetching specifications:', error);
      res.status(500).json({ error: "Failed to fetch specifications" });
    }
  });

  app.get("/api/specifications/categories", requireAdmin, async (req, res) => {
    try {
      const categories = await storage.getSpecificationCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching specification categories:', error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/specifications", requireAdmin, (req, res, next) => {
    specificationsUpload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "File is required" });
        }

        if (!req.body.category || !req.body.title) {
          return res.status(400).json({ error: "Category and title are required" });
        }

        // Upload file to object storage
        const userId = (req.user as any).claims.sub;
        const objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype
        );

        const specData = {
          category: req.body.category,
          title: req.body.title,
          description: req.body.description || null,
          fileName: req.file.originalname,
          filePath: objectPath,
          uploadedBy: userId,
        };

        const spec = await storage.createSpecification(specData);

        // Log activity
        const user = await storage.getUser(userId);
        if (user) {
          try {
            const userName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.email || 'Unknown';
            await storage.createActivity({
              userId: user.id,
              userName: userName,
              userEmail: user.email || '',
              activityType: 'specification_upload',
              fileName: req.file.originalname,
              filePath: objectPath,
              description: `uploaded specification: ${req.body.title} (${req.body.category})`,
              metadata: {
                specificationId: spec.id,
                category: req.body.category,
                title: req.body.title,
              },
            });
          } catch (activityError) {
            console.error('Error logging specification activity:', activityError);
          }
        }

        res.status(201).json(spec);
      } catch (error) {
        console.error('Error creating specification:', error);
        res.status(500).json({ error: "Failed to create specification" });
      }
    });
  });

  app.put("/api/specifications/:id", requireAdmin, specificationsUpload.single('file'), async (req, res) => {
    try {
      const { id } = req.params;
      const updates: any = {};

      if (req.body.category) updates.category = req.body.category;
      if (req.body.title) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description || null;

      // Handle file upload if provided
      if (req.file) {
        const userId = (req.user as any).claims.sub;
        const objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype
        );
        updates.fileName = req.file.originalname;
        updates.filePath = objectPath;
      }

      const spec = await storage.updateSpecification(id, updates);
      if (!spec) {
        return res.status(404).json({ error: "Specification not found" });
      }
      res.json(spec);
    } catch (error) {
      console.error('Error updating specification:', error);
      res.status(500).json({ error: "Failed to update specification" });
    }
  });

  app.delete("/api/specifications/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get specification details before deleting
      const spec = await storage.getSpecification(id);
      if (!spec) {
        return res.status(404).json({ error: "Specification not found" });
      }
      
      const deleted = await storage.deleteSpecification(id);
      if (!deleted) {
        return res.status(404).json({ error: "Specification not found" });
      }
      
      // Log deletion activity
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'specification_delete',
            fileName: spec.fileName,
            filePath: spec.filePath,
            description: `deleted specification: ${spec.title} (${spec.category})`,
            metadata: {
              specificationId: spec.id,
              category: spec.category,
              title: spec.title,
            },
          });
        } catch (activityError) {
          console.error('Error logging specification delete activity:', activityError);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting specification:', error);
      res.status(500).json({ error: "Failed to delete specification" });
    }
  });

  // Configure multer for meeting minutes file uploads
  const meetingMinutesUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
  });

  // Meeting Minutes Routes - Admin/Designer only
  app.get("/api/meeting-minutes", requireAdmin, async (req, res) => {
    try {
      const { projectId, startDate, endDate } = req.query;
      
      let minutes;
      if (projectId) {
        minutes = await storage.getMeetingMinutesByProject(projectId as string);
      } else if (startDate && endDate) {
        minutes = await storage.getMeetingMinutesByDateRange(startDate as string, endDate as string);
      } else {
        minutes = await storage.getAllMeetingMinutes();
      }
      
      res.json(minutes);
    } catch (error) {
      console.error('Error fetching meeting minutes:', error);
      res.status(500).json({ error: "Failed to fetch meeting minutes" });
    }
  });

  app.post("/api/meeting-minutes", requireAdmin, (req, res, next) => {
    meetingMinutesUpload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "File is required" });
        }

        const requiredFields = ['meetingDate', 'meetingTitle', 'meetingType'];
        for (const field of requiredFields) {
          if (!req.body[field]) {
            return res.status(400).json({ error: `${field} is required` });
          }
        }

        // Upload file to object storage
        const userId = (req.user as any).claims.sub;
        const objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype
        );

        const momData = {
          projectId: req.body.projectId || null,
          meetingDate: req.body.meetingDate,
          meetingTitle: req.body.meetingTitle,
          meetingType: req.body.meetingType,
          attendees: req.body.attendees || null,
          location: req.body.location || null,
          filePath: objectPath,
          fileName: req.file.originalname,
          fileType: path.extname(req.file.originalname).slice(1),
          fileSize: req.file.size.toString(),
          summary: req.body.summary || null,
          uploadedBy: userId,
        };

        const minutes = await storage.createMeetingMinutes(momData);

        // Log activity
        const user = await storage.getUser(userId);
        if (user) {
          try {
            const userName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.email || 'Unknown';
            await storage.createActivity({
              userId: user.id,
              userName: userName,
              userEmail: user.email || '',
              activityType: 'meeting_minutes_upload',
              fileName: req.file.originalname,
              filePath: objectPath,
              description: `uploaded meeting minutes: ${req.body.meetingTitle} (${req.body.meetingType})`,
              metadata: {
                momId: minutes.id,
                meetingDate: req.body.meetingDate,
                meetingType: req.body.meetingType,
                projectId: req.body.projectId,
              },
            });
          } catch (activityError) {
            console.error('Error logging meeting minutes activity:', activityError);
          }
        }

        res.status(201).json(minutes);
      } catch (error) {
        console.error('Error creating meeting minutes:', error);
        res.status(500).json({ error: "Failed to create meeting minutes" });
      }
    });
  });

  app.put("/api/meeting-minutes/:id", requireAdmin, meetingMinutesUpload.single('file'), async (req, res) => {
    try {
      const { id } = req.params;
      const updates: any = {};

      if (req.body.projectId !== undefined) updates.projectId = req.body.projectId || null;
      if (req.body.meetingDate) updates.meetingDate = req.body.meetingDate;
      if (req.body.meetingTitle) updates.meetingTitle = req.body.meetingTitle;
      if (req.body.meetingType) updates.meetingType = req.body.meetingType;
      if (req.body.attendees) updates.attendees = req.body.attendees;
      if (req.body.location !== undefined) updates.location = req.body.location || null;
      if (req.body.summary !== undefined) updates.summary = req.body.summary || null;

      // Handle file upload if provided
      if (req.file) {
        const userId = (req.user as any).claims.sub;
        const objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype
        );
        updates.fileName = req.file.originalname;
        updates.filePath = objectPath;
        updates.fileType = path.extname(req.file.originalname).slice(1);
        updates.fileSize = req.file.size.toString();
      }

      const minutes = await storage.updateMeetingMinutes(id, updates);
      if (!minutes) {
        return res.status(404).json({ error: "Meeting minutes not found" });
      }
      res.json(minutes);
    } catch (error) {
      console.error('Error updating meeting minutes:', error);
      res.status(500).json({ error: "Failed to update meeting minutes" });
    }
  });

  app.delete("/api/meeting-minutes/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get meeting minutes details before deleting
      const minutes = await storage.getMeetingMinutes(id);
      if (!minutes) {
        return res.status(404).json({ error: "Meeting minutes not found" });
      }
      
      const deleted = await storage.deleteMeetingMinutes(id);
      if (!deleted) {
        return res.status(404).json({ error: "Meeting minutes not found" });
      }
      
      // Log deletion activity
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'meeting_minutes_delete',
            fileName: minutes.fileName,
            filePath: minutes.filePath,
            description: `deleted meeting minutes: ${minutes.meetingTitle} (${minutes.meetingType})`,
            metadata: {
              momId: minutes.id,
              meetingDate: minutes.meetingDate,
              meetingType: minutes.meetingType,
              projectId: minutes.projectId,
            },
          });
        } catch (activityError) {
          console.error('Error logging meeting minutes delete activity:', activityError);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting meeting minutes:', error);
      res.status(500).json({ error: "Failed to delete meeting minutes" });
    }
  });

  // ===== Works Order Templates Routes =====
  
  // Get all templates (role-based access)
  app.get("/api/works-order-templates", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }

      const templates = await storage.getWorksOrderTemplatesForUser(userId, userRole.role);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching works order templates:', error);
      res.status(500).json({ error: "Failed to fetch works order templates" });
    }
  });

  // Get single template (with role-based access control)
  app.get("/api/works-order-templates/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }

      // Clients cannot access templates
      if (userRole.role === 'client') {
        return res.status(403).json({ error: "Access denied" });
      }

      const template = await storage.getWorksOrderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error('Error fetching works order template:', error);
      res.status(500).json({ error: "Failed to fetch works order template" });
    }
  });

  // Import template (admin/designer only)
  app.post("/api/works-order-templates/import", requireAdmin, multer().single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { categoryId, categoryName, description } = req.body;
      const userId = (req.user as any).claims.sub;

      // Validate file type - only allow specific document types
      const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];

      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Only PDF, Word (.doc, .docx), and Excel (.xls, .xlsx) files are allowed." });
      }

      // Validate file size - max 50MB
      const maxFileSize = 50 * 1024 * 1024; // 50MB in bytes
      if (req.file.size > maxFileSize) {
        return res.status(400).json({ error: "File size exceeds 50MB limit" });
      }

      // Get category only if categoryId is provided (optional for Terms of Contract templates)
      let category = null;
      if (categoryId) {
        category = await storage.getVendorCategory(categoryId);
        if (!category) {
          return res.status(400).json({ error: "Invalid category selected" });
        }
      }

      // Upload file to object storage
      const objectPath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      );

      // Create template with file metadata
      const template = await storage.createWorksOrderTemplate({
        name: categoryName || (category?.name) || "Terms of Contract Template", // Use provided name, category name, or default
        categoryId: categoryId || null,
        description: description || null,
        objectPath,
        originalFileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        isActive: true,
        createdBy: userId,
      });

      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_template_create',
            fileName: template.originalFileName,
            filePath: template.objectPath,
            description: `imported works order template "${template.name}"`,
            metadata: {
              templateId: template.id,
              templateName: template.name,
              categoryName: category?.name || 'Terms of Contract',
            },
          });
        } catch (activityError) {
          console.error('Error logging template import activity:', activityError);
        }
      }

      res.status(201).json(template);
    } catch (error) {
      console.error('Error importing template:', error);
      res.status(500).json({ error: "Failed to import template" });
    }
  });

  // Create template (admin/designer only)
  app.post("/api/works-order-templates", requireAdmin, async (req, res) => {
    try {
      const validated = insertWorksOrderTemplateSchema.parse(req.body);
      const userId = (req.user as any).claims.sub;
      
      const template = await storage.createWorksOrderTemplate({
        ...validated,
        createdBy: userId,
      });
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_template_create',
            fileName: template.name,
            filePath: '',
            description: `created works order template "${template.name}"`,
            metadata: {
              templateId: template.id,
              templateName: template.name,
            },
          });
        } catch (activityError) {
          console.error('Error logging template creation activity:', activityError);
        }
      }
      
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      console.error('Error creating works order template:', error);
      res.status(500).json({ error: "Failed to create works order template" });
    }
  });

  // Update template (admin/designer only)
  app.put("/api/works-order-templates/:id", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const validated = insertWorksOrderTemplateSchema.partial().parse(req.body);
      const template = await storage.updateWorksOrderTemplate(req.params.id, validated);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_template_update',
            fileName: template.name,
            filePath: '',
            description: `updated works order template "${template.name}"`,
            metadata: {
              templateId: template.id,
              templateName: template.name,
            },
          });
        } catch (activityError) {
          console.error('Error logging template update activity:', activityError);
        }
      }
      
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      console.error('Error updating works order template:', error);
      res.status(500).json({ error: "Failed to update works order template" });
    }
  });

  // Delete template (admin/designer only)
  app.delete("/api/works-order-templates/:id", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      
      // Get template details before deleting
      const template = await storage.getWorksOrderTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      const deleted = await storage.deleteWorksOrderTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_template_delete',
            fileName: template.name,
            filePath: '',
            description: `deleted works order template "${template.name}"`,
            metadata: {
              templateId: template.id,
              templateName: template.name,
            },
          });
        } catch (activityError) {
          console.error('Error logging template deletion activity:', activityError);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting works order template:', error);
      res.status(500).json({ error: "Failed to delete works order template" });
    }
  });

  // ===== Works Orders Routes =====

  // Get all works orders (role-based access, optional project filter)
  app.get("/api/works-orders", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }

      const projectId = req.query.projectId as string | undefined;
      const orders = await storage.getWorksOrdersForUser(userId, userRole.role, projectId);
      res.json(orders);
    } catch (error) {
      console.error('Error fetching works orders:', error);
      res.status(500).json({ error: "Failed to fetch works orders" });
    }
  });

  // Export works orders to Excel (admin/designer only) - MUST come before /:id route
  app.get("/api/works-orders/export", requireAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllWorksOrders();
      
      // Prepare data for Excel export
      const exportData = orders.map((order: any) => ({
        'Order Number': order.orderNumber,
        'Title': order.title,
        'Status': order.status,
        'Project ID': order.projectVendorId || 'N/A',
        'Scope': order.scope || '',
        'Total Value': order.totalValue ? `$${order.totalValue}` : '',
        'Start Date': order.startDate || '',
        'Completion Date': order.completionDate || '',
        'Payment Terms': order.paymentTerms || '',
        'Created': order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '',
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Works Orders');

      // Generate Excel buffer
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="works-orders-${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      // Send the buffer
      res.send(buf);
    } catch (error) {
      console.error('Error exporting works orders:', error);
      res.status(500).json({ error: "Failed to export works orders" });
    }
  });

  // Get single works order with relations
  app.get("/api/works-orders/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userRole = await storage.getUserRole(userId);
      if (!userRole) {
        return res.status(403).json({ error: "User role not found" });
      }

      const order = await storage.getWorksOrderWithRelations(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Works order not found" });
      }

      // Role-based access check
      if (userRole.role === 'client') {
        // Clients can only access orders for their assigned projects
        const userProjects = await storage.getProjectsForUser(userId, userRole.role);
        const projectIds = userProjects.map(p => p.id);
        
        const projectVendor = await storage.getProjectVendor(order.projectVendorId);
        if (!projectVendor || !projectIds.includes(projectVendor.projectId)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      res.json(order);
    } catch (error) {
      console.error('Error fetching works order:', error);
      res.status(500).json({ error: "Failed to fetch works order" });
    }
  });

  // Create works order (admin/designer only)
  app.post("/api/works-orders", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      
      // Generate order number
      const orderNumber = await storage.generateOrderNumber();
      
      // Generate access token for client signing
      const accessToken = randomUUID();
      
      const validated = insertWorksOrderSchema.parse({
        ...req.body,
        orderNumber,
        accessToken,
        createdBy: userId,
        status: 'draft',
      });
      
      const order = await storage.createWorksOrder(validated);
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_create',
            fileName: `${orderNumber}.pdf`,
            filePath: '',
            description: `created works order ${orderNumber}`,
            metadata: {
              worksOrderId: order.id,
              orderNumber: order.orderNumber,
              projectVendorId: order.projectVendorId,
            },
          });
        } catch (activityError) {
          console.error('Error logging works order creation activity:', activityError);
        }
      }
      
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid works order data", details: error.errors });
      }
      console.error('Error creating works order:', error);
      res.status(500).json({ error: "Failed to create works order" });
    }
  });

  // Update works order (admin/designer only)
  app.put("/api/works-orders/:id", requireAdmin, async (req, res) => {
    try {
      const validated = insertWorksOrderSchema.partial().parse(req.body);
      const order = await storage.updateWorksOrder(req.params.id, validated);
      
      if (!order) {
        return res.status(404).json({ error: "Works order not found" });
      }
      
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid works order data", details: error.errors });
      }
      console.error('Error updating works order:', error);
      res.status(500).json({ error: "Failed to update works order" });
    }
  });

  // Send works order (mark as sent, admin/designer only)
  app.post("/api/works-orders/:id/send", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const order = await storage.getWorksOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ error: "Works order not found" });
      }
      
      if (order.status !== 'draft') {
        return res.status(400).json({ error: "Only draft orders can be sent" });
      }
      
      // Ensure the order has an access token for client signing
      if (!order.accessToken) {
        await storage.updateWorksOrder(req.params.id, {
          accessToken: randomUUID(),
        });
      }
      
      const updatedOrder = await storage.updateWorksOrderStatus(req.params.id, 'sent', {
        sentAt: new Date(),
      });
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_send',
            fileName: `${order.orderNumber}.pdf`,
            filePath: '',
            description: `sent works order ${order.orderNumber} to client`,
            metadata: {
              worksOrderId: order.id,
              orderNumber: order.orderNumber,
              projectVendorId: order.projectVendorId,
            },
          });
        } catch (activityError) {
          console.error('Error logging works order send activity:', activityError);
        }
      }
      
      res.json(updatedOrder);
    } catch (error) {
      console.error('Error sending works order:', error);
      res.status(500).json({ error: "Failed to send works order" });
    }
  });

  // Void works order (admin/designer only)
  app.post("/api/works-orders/:id/void", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { reason } = req.body;
      const order = await storage.getWorksOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ error: "Works order not found" });
      }
      
      if (order.status === 'void') {
        return res.status(400).json({ error: "Order is already voided" });
      }
      
      const updatedOrder = await storage.updateWorksOrderStatus(req.params.id, 'void', {
        voidedAt: new Date(),
        voidReason: reason || null,
      });
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_void',
            fileName: `${order.orderNumber}.pdf`,
            filePath: '',
            description: `voided works order ${order.orderNumber}${reason ? `: ${reason}` : ''}`,
            metadata: {
              worksOrderId: order.id,
              orderNumber: order.orderNumber,
              projectVendorId: order.projectVendorId,
              voidReason: reason,
            },
          });
        } catch (activityError) {
          console.error('Error logging works order void activity:', activityError);
        }
      }
      
      res.json(updatedOrder);
    } catch (error) {
      console.error('Error voiding works order:', error);
      res.status(500).json({ error: "Failed to void works order" });
    }
  });

  // Delete works order (admin/designer only)
  app.delete("/api/works-orders/:id", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const order = await storage.getWorksOrder(req.params.id);
      
      if (!order) {
        return res.status(404).json({ error: "Works order not found" });
      }
      
      const deleted = await storage.deleteWorksOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Works order not found" });
      }
      
      // Log activity
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_delete',
            fileName: `${order.orderNumber}.pdf`,
            filePath: '',
            description: `deleted works order ${order.orderNumber}`,
            metadata: {
              worksOrderId: order.id,
              orderNumber: order.orderNumber,
              projectVendorId: order.projectVendorId,
            },
          });
        } catch (activityError) {
          console.error('Error logging works order delete activity:', activityError);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting works order:', error);
      res.status(500).json({ error: "Failed to delete works order" });
    }
  });

  // ===== Public Signature Routes (no auth required) =====

  // Get works order by access token (public)
  app.get("/api/works-orders/sign/:token", async (req, res) => {
    try {
      const order = await storage.getWorksOrderByToken(req.params.token);
      
      if (!order) {
        return res.status(404).json({ error: "Works order not found" });
      }
      
      if (order.status !== 'sent') {
        return res.status(400).json({ error: "This works order is not available for signing" });
      }
      
      // Get full order details with relations
      const orderWithRelations = await storage.getWorksOrderWithRelations(order.id);
      
      // Get existing signatures
      const signatures = await storage.getSignaturesByWorksOrder(order.id);
      
      res.json({
        order: orderWithRelations,
        signatures,
      });
    } catch (error) {
      console.error('Error fetching works order for signing:', error);
      res.status(500).json({ error: "Failed to fetch works order" });
    }
  });

  // Submit signature (public)
  app.post("/api/works-orders/sign/:token", async (req, res) => {
    try {
      const order = await storage.getWorksOrderByToken(req.params.token);
      
      if (!order) {
        return res.status(404).json({ error: "Works order not found" });
      }
      
      if (order.status !== 'sent') {
        return res.status(400).json({ error: "This works order is not available for signing" });
      }
      
      const validated = insertWorksOrderSignatureSchema.parse({
        ...req.body,
        worksOrderId: order.id,
      });
      
      // Check if this email has already signed
      const existingSignature = await storage.getSignatureByOrderAndEmail(
        order.id,
        validated.signerEmail
      );
      
      if (existingSignature) {
        return res.status(400).json({ error: "This email has already signed this works order" });
      }
      
      const signature = await storage.createSignature(validated);
      
      // Update order status to signed and set signedAt timestamp
      await storage.updateWorksOrderStatus(order.id, 'signed', {
        signedAt: new Date(),
      });
      
      // Log activity (no user context for public signatures)
      try {
        await storage.createActivity({
          userId: '', // No user for public signatures
          userName: validated.signerName,
          userEmail: validated.signerEmail,
          activityType: 'works_order_sign',
          fileName: `${order.orderNumber}.pdf`,
          filePath: '',
          description: `signed works order ${order.orderNumber}`,
          metadata: {
            worksOrderId: order.id,
            orderNumber: order.orderNumber,
            signatureId: signature.id,
            signerName: validated.signerName,
            signerEmail: validated.signerEmail,
          },
        });
      } catch (activityError) {
        console.error('Error logging signature activity:', activityError);
      }
      
      res.status(201).json({ success: true, signature });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid signature data", details: error.errors });
      }
      console.error('Error submitting signature:', error);
      res.status(500).json({ error: "Failed to submit signature" });
    }
  });

  // Get files for a works order
  app.get("/api/works-orders/:id/files", requireAuth, async (req, res) => {
    try {
      const worksOrderId = req.params.id;
      const files = await db.select().from(worksOrderFiles).where(sql`${worksOrderFiles.worksOrderId} = ${worksOrderId}`);
      res.json(files);
    } catch (error) {
      console.error('Error fetching works order files:', error);
      res.status(500).json({ error: "Failed to fetch works order files" });
    }
  });

  // Import works order
  app.post("/api/works-orders/import", requireAdmin, multer().array('files'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const { projectId, categoryId, categoryName, vendorId } = req.body;

      if (!projectId || !categoryId || !categoryName || !vendorId) {
        return res.status(400).json({ error: "Project, category, and vendor are required" });
      }

      const userId = (req.user as any).claims.sub;

      // Get or create projectVendor for this vendor
      let projectVendorId: string;
      const existingProjectVendors = await storage.getProjectVendors(projectId);
      const existingVendorPV = existingProjectVendors.find(
        pv => pv.vendorId === vendorId && pv.categoryId === categoryId
      );
      
      if (existingVendorPV) {
        projectVendorId = existingVendorPV.id;
      } else {
        // Get vendor name for display
        const vendor = await storage.getVendor(vendorId);
        const vendorName = vendor?.name || 'Unknown Vendor';
        
        // Create projectVendor for this vendor
        const newProjectVendor = await storage.createProjectVendor({
          projectId,
          vendorId,
          categoryId,
          category: categoryName,
          quotationName: `${categoryName} - ${vendorName} Works Order`,
          quotationType: 'quote',
          quotationFile: null,
          status: 'Quoted',
        });
        projectVendorId = newProjectVendor.id;
      }

      // Generate unique order number
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      
      const serialResult = await db.execute(sql`SELECT nextval('works_order_serial_seq'::regclass) as serial`);
      const serial = (serialResult.rows[0] as any).serial;
      const orderNumber = `WO-${serial}${day}${month}${year}`;

      // Create draft works order with file count info
      const firstFile = files[0];
      const sanitizedFileName = firstFile.originalname.replace(/\.[^/.]+$/, "");
      const worksOrder = await storage.createWorksOrder({
        serialCounter: Number(serial),
        orderNumber,
        title: `${sanitizedFileName} - ${categoryName}`,
        status: 'draft',
        templateId: null,
        projectVendorId,
        scope: `Imported works order with ${files.length} file(s)`,
        totalValue: null,
        startDate: null,
        completionDate: null,
        paymentTerms: null,
        createdBy: userId,
      });

      // Upload all files and create file records
      const uploadedFiles = [];
      for (const file of files) {
        const objectPath = await uploadToObjectStorage(
          file.buffer,
          file.originalname,
          userId,
          file.mimetype
        );

        // Create works order file record
        const fileExtension = file.originalname.split('.').pop() || 'unknown';
        await db.insert(worksOrderFiles).values({
          worksOrderId: worksOrder.id,
          fileName: file.originalname,
          filePath: objectPath,
          fileType: fileExtension,
          fileSize: file.size.toString(),
          uploadedBy: userId,
        });

        uploadedFiles.push({
          name: file.originalname,
          path: objectPath,
          size: file.size,
        });
      }

      // Log activity
      try {
        await storage.createActivity({
          userId,
          userName: (req.user as any).claims.name || 'Unknown',
          userEmail: (req.user as any).claims.email || '',
          activityType: 'works_order_create',
          fileName: `${files.length} file(s)`,
          filePath: uploadedFiles[0]?.path || '',
          description: `created works order ${worksOrder.orderNumber} with ${files.length} file(s)`,
          metadata: {
            worksOrderId: worksOrder.id,
            orderNumber: worksOrder.orderNumber,
            categoryId,
            categoryName,
            projectId,
            imported: true,
            fileCount: files.length,
          },
        });
      } catch (activityError) {
        console.error('Error logging import activity:', activityError);
      }

      res.status(201).json({ 
        success: true,
        message: `Works order created successfully with ${files.length} file(s)`,
        worksOrder,
        files: uploadedFiles
      });
    } catch (error) {
      console.error('Error importing works order:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to import works order";
      res.status(500).json({ error: errorMessage });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
