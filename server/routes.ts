import { TRIAL_DURATION_DAYS, WARN_WITHIN_DAYS, SUPPRESS_WITHIN_DAYS } from "./config";
import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, db, requestDb } from "./db";
import { withRequestOrg } from "./tenantContext";
import multer from "multer";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import pdfParse from "pdf-parse";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import libre from "libreoffice-convert";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { getPlanLimits, UNLIMITED } from "./planLimits";
import { setupAuth, isAuthenticated, requireAuth, requireAdmin, requireAdminOnly, requireProjectManagerOrAdmin, requireSuperAdmin, isSuperAdminUser } from "./localAuth";
import { ObjectStorageService, ObjectNotFoundError, parseObjectPath, signObjectURL, downloadObjectBuffer } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { RENDER_STYLES, generateInteriorRender, generateConceptRender, generatePhotorealConversion, detectRoomType, extractRoomName, paraphraseBrief, extractQuoteTotalFromImage } from "./ai/gemini";
import { chatWithDesignAssistant, generateRenderBrief, generateFloorPlanSVG, generateElevationSVG, generateFloorPlanDXFSpec, generateElevationDXFSpec, reviewDesignFile, DesignChatMessage, DesignChatAttachment } from "./ai/claude";
import { generateDXF } from "./utils/dxfGenerator";
import {
  type NotificationPreferences,
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
  worksOrderFiles,
  BILLING_VISIBLE_ROLES
} from "@shared/schema";
import { z } from "zod";

// Session configuration types
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: string;
    impersonatingUserId?: string; // set when a super-admin is impersonating another user
    originalUserId?: string;      // the real super-admin's user id during impersonation
  }
}

// requireProjectAccess is an alias for requireProjectManagerOrAdmin (works orders, meeting minutes)
const requireProjectAccess = requireProjectManagerOrAdmin;

// Strips sensitive credential fields before sending user data to the client
function sanitizeUser(user: Record<string, any>) {
  const { passwordHash, emailVerificationToken, passwordResetToken, passwordResetTokenExpiry, unsubscribeToken, ...safe } = user;
  return safe;
}

// Plan limit enforcement — throws a structured 402 error if the org is at its limit for a resource
async function checkOrgLimit(
  orgId: string,
  resource: 'projects' | 'users' | 'catalogueItems' | 'storageGb',
  incomingBytes: number = 0
): Promise<void> {
  const org = await storage.getOrganisation(orgId);
  const plan = org?.plan || 'trial';
  const limits = getPlanLimits(plan);
  const usage = await storage.getOrgUsage(orgId);
  const limitKey = resource === 'projects' ? 'maxProjects'
    : resource === 'users' ? 'maxUsers'
    : resource === 'storageGb' ? 'maxStorageGb'
    : 'maxCatalogueItems';
  const current = usage[resource];
  const limit = limits[limitKey];

  // Storage: project incoming bytes onto current usage; counts: use current as-is.
  const effective = resource === 'storageGb'
    ? (current as number) + incomingBytes / (1024 * 1024 * 1024)
    : current;

  // Counts: block when already at limit (>= so adding one more would exceed).
  // Storage: block only when projected usage strictly exceeds the cap (>).
  const atOrOverLimit = resource === 'storageGb' ? effective > limit : (current as number) >= limit;
  if (limit < UNLIMITED && atOrOverLimit) {
    const label = resource === 'projects' ? 'projects'
      : resource === 'users' ? 'team members'
      : resource === 'storageGb' ? 'GB of storage'
      : 'catalogue items';
    const err: any = new Error(
      `Plan limit reached: your ${plan} plan allows up to ${limit} ${label}. Upgrade your plan to add more.`
    );
    err.status = 403;
    err.limitExceeded = true;
    err.current = current;
    err.limit = limit;
    err.resource = resource;
    throw err;
  }
}

// Shared helper — call at the top of every upload/create catch block.
// Returns true if the error was a plan-limit rejection (403 sent); caller should return.
function handleLimitError(res: Response, err: any): boolean {
  if (err?.limitExceeded) {
    res.status(403).json({ error: err.message, limitExceeded: true, current: err.current, limit: err.limit, resource: err.resource });
    return true;
  }
  return false;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth (session, passport-local, auth endpoints)
  await setupAuth(app);

  // Impersonation read-only guard — when a super-admin is acting as another user
  // via session.impersonatingUserId, block all mutating HTTP methods except for
  // the dedicated exit endpoint so the impersonated session stays read-only.
  app.use((req, res, next) => {
    const isImpersonating = !!(req.session as Record<string, unknown>)?.impersonatingUserId;
    const isExitEndpoint =
      req.path === "/api/superadmin/impersonate/exit" && req.method === "POST";
    if (
      isImpersonating &&
      !isExitEndpoint &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
    ) {
      return res
        .status(403)
        .json({ error: "Mutating actions are not permitted during impersonation. Exit impersonation first." });
    }
    next();
  });

  // Effective user context — when a super-admin is impersonating another user,
  // replace req.user with the impersonated user so all downstream route handlers
  // naturally see the impersonated user's orgId, role, and other context.
  // The original super-admin user object is preserved on req.superAdminUser so
  // requireSuperAdmin can still verify the real identity during impersonation.
  app.use(async (req, _res, next) => {
    const impersonatingId = req.session?.impersonatingUserId;
    if (!impersonatingId) return next();
    try {
      const impersonatedUser = await storage.getUser(impersonatingId);
      if (impersonatedUser) {
        (req as any).superAdminUser = req.user; // preserve original for requireSuperAdmin
        req.user = impersonatedUser as Express.User;
      }
    } catch {
      // If lookup fails, leave req.user unchanged so the super-admin isn't locked out
    }
    next();
  });

  // Object Storage endpoints for permanent file storage
  // Endpoint to get presigned upload URL
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      // fileSizeBytes is required — reject unknown-size uploads so storage quota
      // cannot be bypassed by omitting this field.
      const fileSizeBytes = Number(req.body?.fileSizeBytes);
      if (!fileSizeBytes || fileSizeBytes <= 0) {
        return res.status(400).json({ error: "fileSizeBytes is required and must be a positive number" });
      }
      if (user.orgId) await checkOrgLimit(user.orgId, 'storageGb', fileSizeBytes);

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      if (error.limitExceeded) return res.status(403).json({ error: error.message, limitExceeded: true, current: error.current, limit: error.limit, resource: error.resource });
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Endpoint to serve private objects from object storage
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    console.log("📥 OBJECT DOWNLOAD REQUEST:", req.path);
    const userId = (req.user as any).id;
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

  // Endpoint to convert Word/Excel documents to PDF for viewing
  app.get("/api/office-to-pdf", requireAuth, async (req, res) => {
    const filePath = req.query.path as string;
    
    if (!filePath) {
      return res.status(400).json({ error: "File path is required" });
    }
    
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(filePath);
      
      // Check access permissions
      const userId = (req.user as any).id;
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Download the file buffer
      const buffer = await downloadObjectBuffer(objectFile);
      
      // Convert to PDF using LibreOffice
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        libre.convert(buffer, '.pdf', undefined, (err: Error | null, result: Buffer) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error converting to PDF:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found" });
      }
      return res.status(500).json({ error: "Failed to convert document" });
    }
  });

  // Helper function to upload file buffer to object storage and return the object path
  async function uploadToObjectStorage(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    mimeType: string,
    orgId?: string
  ): Promise<string> {
    // Enforce per-org storage limit before sending bytes to object storage.
    // incomingBytes is the exact size from the already-buffered file, making the
    // check precise: orgs whose usage + this file would exceed the plan cap are rejected.
    if (orgId) await checkOrgLimit(orgId, 'storageGb', fileBuffer.byteLength);

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
          const userId = (req.user as any).id;
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
          const userId = (req.user as any).id;
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
          const userId = (req.user as any).id;
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
          const userId = (req.user as any).id;
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
          const userId = (req.user as any).id;
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
          const userId = (req.user as any).id;
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
          const userId = (req.user as any).id;
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
  // Real auth endpoint to get current user.
  // req.user is already the effective user (impersonated or real) thanks to
  // the effective-user middleware registered above.
  app.get('/api/auth/user', isAuthenticated, withRequestOrg, async (req, res) => {
    try {
      const effectiveUser = req.user as { id: string };
      const isImpersonating = !!req.session?.impersonatingUserId;

      const user = await storage.getUser(effectiveUser.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userRole = await storage.getUserRole(user.id);

      res.json({
        ...sanitizeUser(user),
        role: userRole?.role || "client",
        orgId: user.orgId || null,
        onboardingCompletedAt: user.onboardingCompletedAt || null,
        // Use the same env-fallback logic as requireSuperAdmin so a user listed
        // in SUPER_ADMIN_EMAILS can reach /superadmin even before the DB flag is set.
        isSuperAdmin: isSuperAdminUser(user),
        _impersonating: isImpersonating,
        _originalUserId: isImpersonating ? req.session.originalUserId : undefined,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  
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

      // Strict org boundary: org admins can only manage users in their own org.
      // Legacy admins (no orgId) retain unrestricted access for backward compat.
      const caller = await storage.getUser((req.user as any).id);
      if (caller?.orgId && user.orgId !== caller.orgId) {
        return res.status(403).json({ error: "You can only manage users within your own workspace." });
      }

      // Update user role
      const updatedRole = await storage.updateUserRole(userId, role);
      if (!updatedRole) {
        // Create new role if none exists
        const currentUserId = (req.user as any).id;
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
      const caller = await storage.getUser((req.user as any).id);
      // Org-scoped: if caller belongs to an org, only return org members.
      // Backward-compat: legacy admins without an org still get all users.
      const userList = caller?.orgId
        ? await storage.getUsersByOrg(caller.orgId)
        : await storage.getAllUsers();

      const usersWithRoles = await Promise.all(
        userList.map(async (user) => {
          const role = await storage.getUserRole(user.id);
          return {
            ...sanitizeUser(user),
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
  
  // Generate a password reset link for any user (admin only — for sharing via WhatsApp/email)
  app.post("/api/admin/users/:userId/reset-link", requireAdminOnly, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Reuse existing valid token to avoid invalidating a link already shared
      let token: string;
      let expiry: Date;
      const existingTokenStillValid =
        user.passwordResetToken &&
        user.passwordResetTokenExpiry &&
        user.passwordResetTokenExpiry > new Date();

      if (existingTokenStillValid) {
        token = user.passwordResetToken!;
        expiry = user.passwordResetTokenExpiry!;
      } else {
        token = randomUUID();
        expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await storage.setPasswordResetToken(userId, token, expiry);
      }

      const domains = process.env.REPLIT_DOMAINS;
      const baseUrl =
        process.env.APP_URL ||
        (domains ? `https://${domains.split(",")[0]}` : `${req.protocol}://${req.hostname}`);

      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      res.json({ resetUrl, email: user.email });
    } catch (error) {
      console.error("Generate reset link error:", error);
      res.status(500).json({ error: "Failed to generate reset link" });
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
  
  // ─── Organisations ────────────────────────────────────────────────────────

  app.get("/api/organisations/:id", isAuthenticated, async (req, res) => {
    try {
      const callerUser = await storage.getUser((req.user as any).id);
      if (!callerUser?.orgId || callerUser.orgId !== req.params.id) {
        return res.status(403).json({ error: "Access denied." });
      }
      const org = await storage.getOrganisation(req.params.id);
      if (!org) return res.status(404).json({ error: "Organisation not found" });
      res.json(org);
    } catch (err) {
      console.error("Get organisation error:", err);
      res.status(500).json({ error: "Failed to fetch organisation" });
    }
  });

  app.patch("/api/organisations/:id", requireAdminOnly, async (req, res) => {
    try {
      const callerUser = await storage.getUser((req.user as any).id);
      if (!callerUser?.orgId || callerUser.orgId !== req.params.id) {
        return res.status(403).json({ error: "You can only update your own organisation." });
      }
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
      const updated = await storage.updateOrganisation(req.params.id, { name: name.trim() });
      if (!updated) return res.status(404).json({ error: "Organisation not found" });
      res.json(updated);
    } catch (err) {
      console.error("Update organisation error:", err);
      res.status(500).json({ error: "Failed to update organisation" });
    }
  });

  // ─── Invitations ──────────────────────────────────────────────────────────

  // GET /api/invitations — list pending invitations for caller's org (admin only)
  app.get("/api/invitations", requireAdminOnly, async (req, res) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.orgId) return res.json([]);
      const invites = await storage.getInvitationsByOrg(user.orgId);
      res.json(invites);
    } catch (err) {
      console.error("List invitations error:", err);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  // POST /api/invitations — send an invitation
  app.post("/api/invitations", requireAdminOnly, async (req, res) => {
    try {
      const { email, role } = req.body;
      if (!email || !role) return res.status(400).json({ error: "Email and role are required" });
      if (!["admin", "designer", "project_manager", "client"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const callerUser = await storage.getUser((req.user as any).id);
      if (!callerUser?.orgId) {
        return res.status(400).json({ error: "Your account is not associated with an organisation. Please sign up via the new workspace flow." });
      }

      const org = await storage.getOrganisation(callerUser.orgId);
      if (!org) return res.status(404).json({ error: "Organisation not found" });

      const normalizedEmail = email.toLowerCase().trim();

      // Check if already a member
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser?.orgId === callerUser.orgId) {
        return res.status(409).json({ error: "This person is already a member of your workspace." });
      }

      // Check for existing pending invite
      const existingInvites = await storage.getInvitationsByOrg(callerUser.orgId);
      const existingPending = existingInvites.find(
        (i) => i.email.toLowerCase() === normalizedEmail && !i.acceptedAt && i.expiresAt > new Date()
      );
      if (existingPending) {
        return res.status(409).json({ error: "An invitation has already been sent to this email. Use resend to send a new link." });
      }

      // Check user limit before creating invitation
      await checkOrgLimit(callerUser.orgId, 'users');

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

      const invitation = await storage.createInvitation({
        orgId: callerUser.orgId,
        email: normalizedEmail,
        role,
        token,
        invitedBy: callerUser.id,
        expiresAt,
      });

      const domains = process.env.REPLIT_DOMAINS;
      const baseUrl = process.env.APP_URL || (domains ? `https://${domains.split(",")[0]}` : `${req.protocol}://${req.hostname}`);
      const inviterName = [callerUser.firstName, callerUser.lastName].filter(Boolean).join(" ") || callerUser.email || "A team member";

      try {
        const { sendInvitationEmail } = await import("./email");
        await sendInvitationEmail(normalizedEmail, inviterName, org.name, role, token, baseUrl);
      } catch (emailErr) {
        console.error("[INVITE] Failed to send invitation email:", emailErr);
      }

      res.status(201).json(invitation);
    } catch (err: any) {
      if (err.limitExceeded) return res.status(403).json({ error: err.message, limitExceeded: true, current: err.current, limit: err.limit, resource: err.resource });
      console.error("Send invitation error:", err);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });

  // DELETE /api/invitations/:id — revoke an invitation
  app.delete("/api/invitations/:id", requireAdminOnly, async (req, res) => {
    try {
      const callerUser = await storage.getUser((req.user as any).id);
      if (!callerUser?.orgId) return res.status(403).json({ error: "No organisation found." });

      // Ensure the invite belongs to the caller's org before revoking
      const orgInvites = await storage.getInvitationsByOrg(callerUser.orgId);
      const invite = orgInvites.find((i) => i.id === req.params.id);
      if (!invite) return res.status(404).json({ error: "Invitation not found." });

      await storage.revokeInvitation(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Revoke invitation error:", err);
      res.status(500).json({ error: "Failed to revoke invitation" });
    }
  });

  // POST /api/invitations/:id/resend — resend an invitation with a fresh token
  app.post("/api/invitations/:id/resend", requireAdminOnly, async (req, res) => {
    try {
      const callerUser = await storage.getUser((req.user as any).id);
      if (!callerUser?.orgId) return res.status(400).json({ error: "No organisation found" });

      const org = await storage.getOrganisation(callerUser.orgId);
      const invites = await storage.getInvitationsByOrg(callerUser.orgId);
      const invite = invites.find((i) => i.id === req.params.id);
      if (!invite) return res.status(404).json({ error: "Invitation not found" });

      const newToken = randomUUID();
      const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
      const updated = await storage.updateInvitationToken(invite.id, newToken, newExpiry);

      const domains = process.env.REPLIT_DOMAINS;
      const baseUrl = process.env.APP_URL || (domains ? `https://${domains.split(",")[0]}` : `${req.protocol}://${req.hostname}`);
      const inviterName = [callerUser.firstName, callerUser.lastName].filter(Boolean).join(" ") || callerUser.email || "A team member";

      try {
        const { sendInvitationEmail } = await import("./email");
        await sendInvitationEmail(invite.email, inviterName, org?.name || "your workspace", invite.role, newToken, baseUrl);
      } catch (emailErr) {
        console.error("[INVITE] Failed to resend invitation email:", emailErr);
      }

      res.json(updated);
    } catch (err) {
      console.error("Resend invitation error:", err);
      res.status(500).json({ error: "Failed to resend invitation" });
    }
  });

  // GET /api/invitations/token/:token — public endpoint to get invite details
  app.get("/api/invitations/token/:token", async (req, res) => {
    try {
      const invite = await storage.getInvitationByToken(req.params.token);
      if (!invite) return res.status(404).json({ error: "Invitation not found or already used." });
      if (invite.acceptedAt) return res.status(410).json({ error: "This invitation has already been accepted." });
      if (invite.expiresAt < new Date()) return res.status(410).json({ error: "This invitation link has expired. Please ask your admin to resend it." });

      const org = await storage.getOrganisation(invite.orgId);
      const inviter = await storage.getUser(invite.invitedBy);
      const inviterName = [inviter?.firstName, inviter?.lastName].filter(Boolean).join(" ") || inviter?.email || "A team member";

      const existingAccount = await storage.getUserByEmail(invite.email);
      res.json({
        email: invite.email,
        role: invite.role,
        orgName: org?.name || "your workspace",
        invitedBy: inviterName,
        accountExists: !!existingAccount,
      });
    } catch (err) {
      console.error("Get invitation details error:", err);
      res.status(500).json({ error: "Failed to fetch invitation details" });
    }
  });

  // POST /api/invitations/token/:token/accept — accept invite and create account
  app.post("/api/invitations/token/:token/accept", async (req, res) => {
    try {
      const { firstName, lastName, password } = req.body;
      if (!password || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters." });
      }

      const invite = await storage.getInvitationByToken(req.params.token);
      if (!invite) return res.status(404).json({ error: "Invitation not found or already used." });
      if (invite.acceptedAt) return res.status(410).json({ error: "This invitation has already been accepted." });
      if (invite.expiresAt < new Date()) return res.status(410).json({ error: "This invitation link has expired." });

      const existing = await storage.getUserByEmail(invite.email);
      if (existing) {
        // Reject if already in a different workspace
        if (existing.orgId && existing.orgId !== invite.orgId) {
          return res.status(409).json({
            error: "This email is already associated with a different workspace. Please use a different email address or ask your current workspace admin to remove your account first.",
          });
        }
        // Link account to inviting org (if not already set)
        if (!existing.orgId) {
          await storage.setUserOrgId(existing.id, invite.orgId);
        }
        const existingRole = await storage.getUserRole(existing.id);
        if (!existingRole) {
          await storage.createUserRole({ userId: existing.id, role: invite.role, isActive: true, assignedBy: invite.invitedBy });
        } else {
          await storage.updateUserRole(existing.id, invite.role);
        }
        await storage.acceptInvitation(req.params.token);

        // Notify the inviter (if non-admin and opted in) that their invitation was accepted
        try {
          const inviter = await storage.getUser(invite.invitedBy);
          if (inviter && inviter.email) {
            const inviterRole = await storage.getUserRole(inviter.id);
            if (inviterRole && inviterRole.role !== "admin") {
              const prefs = await storage.getNotificationPreferences(inviter.id);
              if (prefs.invitationAccepted) {
                const { sendInvitationAcceptedEmail } = await import("./email");
                const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(inviter.id);
                const inviteeName = [existing.firstName, existing.lastName].filter(Boolean).join(" ") || existing.email;
                const org = await storage.getOrganisation(invite.orgId);
                const domains = process.env.REPLIT_DOMAINS;
                const baseUrl = process.env.APP_URL || (domains ? `https://${domains.split(",")[0]}` : `${req.protocol}://${req.hostname}`);
                await sendInvitationAcceptedEmail(inviter.email, inviteeName, org?.name || "your workspace", {
                  unsubscribeToken,
                  baseUrl,
                });
              }
            }
          }
        } catch (emailErr) {
          console.error("Failed to send invitation-accepted notification:", emailErr);
        }

        req.logIn(existing, (err) => {
          if (err) return res.status(500).json({ error: "Account linked but auto-login failed." });
          res.json({ success: true });
        });
        return;
      }

      // New user
      const hash = await bcrypt.hash(password, 12);
      const userId = randomUUID();
      const newUser = await storage.upsertUser({
        id: userId,
        email: invite.email,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        passwordHash: hash,
        emailVerificationToken: null,
        emailVerifiedAt: new Date(), // already verified via invite link
        orgId: invite.orgId,
      });

      await storage.createUserRole({ userId: newUser.id, role: invite.role, isActive: true, assignedBy: invite.invitedBy });
      await storage.acceptInvitation(req.params.token);

      // Notify the inviter (if non-admin and opted in) that their invitation was accepted
      try {
        const inviter = await storage.getUser(invite.invitedBy);
        if (inviter && inviter.email) {
          const inviterRole = await storage.getUserRole(inviter.id);
          if (inviterRole && inviterRole.role !== "admin") {
            const prefs = await storage.getNotificationPreferences(inviter.id);
            if (prefs.invitationAccepted) {
              const { sendInvitationAcceptedEmail } = await import("./email");
              const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(inviter.id);
              const inviteeName = [newUser.firstName, newUser.lastName].filter(Boolean).join(" ") || newUser.email;
              const org = await storage.getOrganisation(invite.orgId);
              const domains = process.env.REPLIT_DOMAINS;
              const baseUrl = process.env.APP_URL || (domains ? `https://${domains.split(",")[0]}` : `${req.protocol}://${req.hostname}`);
              await sendInvitationAcceptedEmail(inviter.email, inviteeName, org?.name || "your workspace", {
                unsubscribeToken,
                baseUrl,
              });
            }
          }
        }
      } catch (emailErr) {
        console.error("Failed to send invitation-accepted notification:", emailErr);
      }

      req.logIn(newUser, (err) => {
        if (err) return res.status(500).json({ error: "Account created but auto-login failed. Please sign in." });
        res.json({ success: true });
      });
    } catch (err) {
      console.error("Accept invitation error:", err);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // User Project Assignments routes (admin only) - for project_manager role
  // Get all project assignments (for Settings page)
  app.get("/api/user-project-assignments", requireAdminOnly, async (req, res) => {
    try {
      const assignments = await storage.getAllUserProjectAssignments();
      res.json(assignments);
    } catch (error) {
      console.error('Get all user project assignments error:', error);
      res.status(500).json({ error: "Failed to fetch user project assignments" });
    }
  });
  
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
      const currentUserId = (req.user as any).id;
      
      const assignment = await storage.assignUserToProject({
        userId,
        projectId,
        assignedBy: currentUserId
      });

      // Notify the newly assigned user (if non-admin and opted in) about the project assignment
      try {
        const assignedUser = await storage.getUser(userId);
        if (assignedUser?.email) {
          const assignedRole = await storage.getUserRole(userId);
          if (assignedRole && assignedRole.role !== "admin") {
            const prefs = await storage.getNotificationPreferences(userId);
            if (prefs.projectUpdates) {
              const project = await storage.getProject(projectId);
              const assigner = await storage.getUser(currentUserId);
              const assignerName = assigner
                ? ([assigner.firstName, assigner.lastName].filter(Boolean).join(" ") || assigner.email || "Your team")
                : "Your team";
              if (project) {
                const { sendProjectUpdateEmail } = await import("./email");
                const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(userId);
                const domains = process.env.REPLIT_DOMAINS;
                const baseUrl = process.env.APP_URL || (domains ? `https://${domains.split(",")[0]}` : `${req.protocol}://${req.hostname}`);
                await sendProjectUpdateEmail(assignedUser.email, project.projectName, assignerName, { unsubscribeToken, baseUrl });
              }
            }
          }
        }
      } catch (emailErr) {
        console.error("Failed to send project assignment notification:", emailErr);
      }

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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
        const userId = (req.user as any).id;
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

  // Reassign all project_vendor links from one vendor to another (admin only)
  app.post("/api/vendors/:id/reassign", requireAdmin, async (req, res) => {
    try {
      const sourceId = req.params.id;
      const { targetVendorId } = req.body;
      if (!targetVendorId || typeof targetVendorId !== "string") {
        return res.status(400).json({ error: "targetVendorId is required" });
      }
      if (sourceId === targetVendorId) {
        return res.status(400).json({ error: "Source and target vendor must be different" });
      }
      const sourceVendor = await storage.getVendor(sourceId);
      if (!sourceVendor) return res.status(404).json({ error: "Source vendor not found" });
      const targetVendor = await storage.getVendor(targetVendorId);
      if (!targetVendor) return res.status(404).json({ error: "Target vendor not found" });
      // Update all project_vendors pointing to sourceId to point to targetVendorId
      await db.execute(
        sql`UPDATE project_vendors SET vendor_id = ${targetVendorId} WHERE vendor_id = ${sourceId}`
      );
      res.json({ message: `Reassigned all project links from "${sourceVendor.name}" to "${targetVendor.name}"` });
    } catch (error) {
      console.error("Error reassigning vendor projects:", error);
      res.status(500).json({ error: "Failed to reassign vendor projects" });
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
  // Get all projects (admin only) - for Settings page project assignments
  app.get("/api/projects/all", requireAdminOnly, async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error('Get all projects error:', error);
      res.status(500).json({ error: "Failed to fetch all projects" });
    }
  });

  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const user = req.user as any;
      if (user.orgId) await checkOrgLimit(user.orgId, 'projects');
      const parsed = insertProjectSchema.parse(req.body);
      // Stamp orgId so the project is org-scoped for usage counting
      const project = await storage.createProject({ ...parsed, orgId: user.orgId ?? null });
      res.status(201).json(project);
    } catch (error: any) {
      if (error.limitExceeded) return res.status(403).json({ error: error.message, limitExceeded: true, current: error.current, limit: error.limit, resource: error.resource });
      res.status(400).json({ error: "Invalid project data" });
    }
  });

  app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      
      // Strip orgId — project ownership is immutable via the API.
      const { orgId: _omit, ...parsed } = insertProjectSchema.partial().parse(req.body);
      
      // Check if user is admin/designer
      if (role === 'admin' || role === 'designer') {
        // Admin/designer can update any field
        const project = await storage.updateProject(req.params.id, parsed);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        // Notify assigned non-admin users who have projectUpdates enabled
        try {
          const assignments = await storage.getUsersAssignedToProject(project.id);
          const updaterUser = await storage.getUser(userId);
          const updaterName = updaterUser
            ? ([updaterUser.firstName, updaterUser.lastName].filter(Boolean).join(" ") || updaterUser.email || "Your team")
            : "Your team";
          const domains = process.env.REPLIT_DOMAINS;
          const baseUrl = process.env.APP_URL || (domains ? `https://${domains.split(",")[0]}` : `${req.protocol}://${req.hostname}`);
          const { sendProjectUpdateEmail } = await import("./email");
          for (const assignment of assignments) {
            const assignedUser = await storage.getUser(assignment.userId);
            if (!assignedUser?.email) continue;
            const assignedRole = await storage.getUserRole(assignment.userId);
            if (!assignedRole || assignedRole.role === "admin") continue;
            const prefs = await storage.getNotificationPreferences(assignment.userId);
            if (!prefs.projectUpdates) continue;
            const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(assignment.userId);
            await sendProjectUpdateEmail(assignedUser.email, project.projectName, updaterName, { unsubscribeToken, baseUrl });
          }
        } catch (emailErr) {
          console.error("Failed to send project update notifications:", emailErr);
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
      const userId = (req.user as any).id;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      
      // Strip orgId — project ownership is immutable via the API.
      const { orgId: _omit3, ...parsed } = insertProjectSchema.partial().parse(req.body);
      
      // Check if user is admin/designer
      if (role === 'admin' || role === 'designer') {
        // Admin/designer can update any field
        const project = await storage.updateProject(req.params.id, parsed);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        // Notify assigned non-admin users who have projectUpdates enabled
        try {
          const assignments = await storage.getUsersAssignedToProject(project.id);
          const updaterUser = await storage.getUser(userId);
          const updaterName = updaterUser
            ? ([updaterUser.firstName, updaterUser.lastName].filter(Boolean).join(" ") || updaterUser.email || "Your team")
            : "Your team";
          const domains = process.env.REPLIT_DOMAINS;
          const baseUrl = process.env.APP_URL || (domains ? `https://${domains.split(",")[0]}` : `${req.protocol}://${req.hostname}`);
          const { sendProjectUpdateEmail } = await import("./email");
          for (const assignment of assignments) {
            const assignedUser = await storage.getUser(assignment.userId);
            if (!assignedUser?.email) continue;
            const assignedRole = await storage.getUserRole(assignment.userId);
            if (!assignedRole || assignedRole.role === "admin") continue;
            const prefs = await storage.getNotificationPreferences(assignment.userId);
            if (!prefs.projectUpdates) continue;
            const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(assignment.userId);
            await sendProjectUpdateEmail(assignedUser.email, project.projectName, updaterName, { unsubscribeToken, baseUrl });
          }
        } catch (emailErr) {
          console.error("Failed to send project update notifications:", emailErr);
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
          const quoteProject = await storage.getProject(projectVendor.projectId);
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
              projectName: quoteProject?.projectName ?? null,
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
      const userId = (req.user as any).id;
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
      
      // Pre-fetch ALL BOQ items in a single query to avoid N+1 database round trips
      const allProjectVendorIds = projectVendors.map(pv => pv.id);
      const allBOQItems = await storage.getBOQBulkByProjectVendors(allProjectVendorIds);
      const boqByProjectVendor = new Map<string, typeof allBOQItems>();
      for (const item of allBOQItems) {
        if (!boqByProjectVendor.has(item.projectVendorId)) {
          boqByProjectVendor.set(item.projectVendorId, []);
        }
        boqByProjectVendor.get(item.projectVendorId)!.push(item);
      }

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
            const boqItems = boqByProjectVendor.get(pv.id) || [];
            if (boqItems.length > 0) {
              const calculatedTotal = boqItems.reduce((sum, item) => {
                return sum + parseFloat(item.totalAmount || '0');
              }, 0);
              if (calculatedTotal > 0) {
                quotationValue = calculatedTotal.toString();
              }
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

  // Project Cost Items — custom line items added by designers
  app.get("/api/project-cost-items/:projectId", requireAuth, async (req, res) => {
    try {
      const items = await storage.getProjectCostItems(req.params.projectId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project cost items" });
    }
  });

  app.post("/api/project-cost-items/:projectId", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const item = await storage.createProjectCostItem({
        projectId: req.params.projectId,
        categoryName: req.body.categoryName ?? "",
        vendorName: req.body.vendorName ?? "",
        amount: req.body.amount ?? "0",
        sortOrder: req.body.sortOrder ?? 0,
        orgId: user.orgId ?? null,
      });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create project cost item" });
    }
  });

  app.put("/api/project-cost-items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.updateProjectCostItem(req.params.id, {
        categoryName: req.body.categoryName,
        vendorName: req.body.vendorName,
        amount: req.body.amount,
        sortOrder: req.body.sortOrder,
      });
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project cost item" });
    }
  });

  app.delete("/api/project-cost-items/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectCostItem(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Item not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project cost item" });
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
      workbook.creator = 'Olympik Design';
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

  app.post("/api/quote-templates", requireProjectManagerOrAdmin, async (req, res) => {
    try {
      const parsed = insertQuoteTemplateSchema.parse(req.body);
      const template = await storage.createQuoteTemplate(parsed);
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ error: "Invalid template data" });
    }
  });

  app.put("/api/quote-templates/:id", requireProjectManagerOrAdmin, async (req, res) => {
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

  app.delete("/api/quote-templates/:id", requireProjectManagerOrAdmin, async (req, res) => {
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
      fileSize: 21 * 1024 * 1024, // 21MB limit
      files: 1, // Only allow single file upload
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'application/pdf', // .pdf for reference files
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/bmp',
        'image/tiff',
      ];
      
      // Also check file extension as MIME types can be unreliable
      const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only Excel (.xlsx, .xls), CSV, PDF, and image files (JPG, PNG, WebP) are allowed.'));
      }
    }
  });

  // Configure multer for moodboard uploads (using memoryStorage for object storage)
  const uploadMoodboard = multer({
    storage: multer.memoryStorage(), // Store in memory, then upload to object storage
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit (CAD/DWG files can be large)
      files: 1, // Only allow single file upload
    },
  });

  // Configure multer for AI render uploads (larger limit for high-res images from Neo Foyr)
  const uploadAIRender = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for AI renders
      files: 6, // 1 main image + 5 reference photos
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg', 
        'image/png',
        'image/svg+xml',
        'image/webp',
        'image/heic',  // iOS photo library (HEIC format)
        'image/heif',  // iOS photo library (HEIF format)
        'application/pdf', // PDF exports from Canva
      ];
      
      // Also check file extension as MIME types can be unreliable
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.svg', '.webp', '.pdf', '.heic', '.heif'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images (JPEG, PNG, SVG, WebP, HEIC) and PDF files are allowed.'));
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
        
        // If the PDF had no extractable text (scanned image PDF), fall back to AI vision
        const hasExtractedContent = result.items.length > 0 || (result.totals.grandTotal && result.totals.grandTotal > 0);
        if (!hasExtractedContent && !isUnitRate) {
          console.log('[QuoteExtraction] PDF has no extractable text — trying AI vision extraction');
          const imageBase64 = fileBuffer.toString('base64');
          const aiResult = await extractQuoteTotalFromImage(imageBase64, 'application/pdf');
          console.log(`[QuoteExtraction] AI vision result for scanned PDF: grandTotal=${aiResult.grandTotal}, confidence=${aiResult.confidence}, items=${aiResult.items.length}`);
          if (aiResult.grandTotal && aiResult.grandTotal > 0) {
            const aiItems = aiResult.items.map((it: any) => ({
              description: it.description || '',
              quantity: it.quantity || 0,
              unit: it.unit || 'unit',
              'unit rate': it.unitRate || 0,
              amount: it.amount || 0,
            }));
            return {
              items: aiItems,
              totals: { grandTotal: aiResult.grandTotal },
              originalFormat: 'pdf',
              aiExtracted: true,
              aiConfidence: aiResult.confidence,
            };
          }
        }

        // Return both items and totals for PDF processing
        return {
          items: result.items,
          totals: result.totals,
          originalFormat: 'pdf'
        };
      } else if (mimeType.startsWith('image/') || (fileName && /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(fileName))) {
        // Image file — use Gemini vision to extract the quote total
        console.log(`[QuoteExtraction] Image file detected (${mimeType}), using AI vision extraction`);
        const imageBase64 = fileBuffer.toString('base64');
        const aiResult = await extractQuoteTotalFromImage(imageBase64, mimeType);
        console.log(`[QuoteExtraction] AI vision result: grandTotal=${aiResult.grandTotal}, confidence=${aiResult.confidence}, items=${aiResult.items.length}`);

        if (isUnitRate) {
          return {
            items: [],
            totals: { grandTotal: -1 },
            originalFormat: 'image',
            aiExtracted: true,
            aiConfidence: aiResult.confidence,
          };
        }

        const aiItems = aiResult.items.map((it: any) => ({
          description: it.description || '',
          quantity: it.quantity || 0,
          unit: it.unit || 'unit',
          'unit rate': it.unitRate || 0,
          amount: it.amount || 0,
        }));

        return {
          items: aiItems,
          totals: { grandTotal: aiResult.grandTotal ?? undefined },
          originalFormat: 'image',
          aiExtracted: true,
          aiConfidence: aiResult.confidence,
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
  app.post("/api/quotes/import", requireProjectManagerOrAdmin, upload.single('quoteFile'), async (req, res) => {
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
      const userId = (req.user as any).id;
      const objectPath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      ,
          (req.user as any).orgId
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
              quotationValue: results.projectVendor.quotationValue,
              projectName: project.projectName,
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

    } catch (error: any) {
      if (handleLimitError(res, error)) return;
      console.error('Quote import error:', error);
      res.status(500).json({ 
        error: "Failed to import quote",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Resolve import conflict - when user decides if it's option or new item
  app.post("/api/quotes/import/resolve", requireProjectManagerOrAdmin, async (req, res) => {
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
      const userId = (req.user as any).id;
      const objectPath = await uploadToObjectStorage(
        tempData.buffer,
        tempData.originalname,
        userId,
        tempData.mimetype
      ,
          (req.user as any).orgId
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
              quotationType: resolutionType,
              projectName: project?.projectName ?? null,
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

    } catch (error: any) {
      if (handleLimitError(res, error)) return;
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
  app.post("/api/quote-templates/import", requireProjectManagerOrAdmin, upload.single('templateFile'), async (req, res) => {
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
      const objectPath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      ,
          (req.user as any).orgId
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
        const floorPlanProject = await storage.getProject(projectId);
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email || '',
          activityType: 'floor_plan_upload' as any,
          fileName: req.file.originalname,
          description: `uploaded floor plan: ${name}`,
          projectId: projectId,
          metadata: { floorPlanId: floorPlan.id, version: floorPlan.version, projectName: floorPlanProject?.projectName ?? null }
        });
      }
      
      res.status(201).json(floorPlan);
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
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
      const userId = (req.user as any).id;
      
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
        const floorPlanDelProject = await storage.getProject(floorPlan.projectId);
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
          metadata: { projectName: floorPlanDelProject?.projectName ?? null },
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
      // Prevent browser caching to ensure fresh data after saves
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const userId = (req.user as any).id;
      const userRole = await storage.getUserRole(userId);
      const { projectId, assetType } = req.query;
      const validAssetType = typeof assetType === 'string' ? assetType : undefined;
      const validProjectId = typeof projectId === 'string' ? projectId : undefined;
      
      // If no role found, treat as 'client' (users without designer/admin role)
      const role = userRole?.role || 'client';
      
      console.log('[Moodboards Fetch] Query params:', { projectId: validProjectId, assetType: validAssetType, role });
      
      // Use role-based helper method for consistent access control
      const moodboards = await storage.getMoodboardsForUser(userId, role, validProjectId, validAssetType);
      
      console.log('[Moodboards Fetch] Returning', moodboards.length, 'moodboards');
      if (validAssetType === 'render') {
        console.log('[Moodboards Fetch] Render IDs:', moodboards.map(m => ({ id: m.id, name: m.name, assetType: m.assetType })).slice(0, 5));
      }
      
      res.json(moodboards);
    } catch (error) {
      console.error('Error fetching moodboards:', error);
      res.status(500).json({ error: "Failed to fetch moodboards" });
    }
  });

  // Get moodboards by asset type — uses a path segment instead of query param to avoid proxy WAF blocks
  app.get("/api/moodboards/by-type/:type", requireAuth, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const userId = (req.user as any).id;
      const userRole = await storage.getUserRole(userId);
      const { type } = req.params;
      const { projectId } = req.query;
      const validProjectId = typeof projectId === 'string' ? projectId : undefined;
      const role = userRole?.role || 'client';

      console.log('[Moodboards Fetch] type:', type, 'projectId:', validProjectId, 'role:', role);

      const moodboards = await storage.getMoodboardsForUser(userId, role, validProjectId, type);

      console.log('[Moodboards Fetch] Returning', moodboards.length, 'items of type', type);
      res.json(moodboards);
    } catch (error) {
      console.error('Error fetching moodboards by type:', error);
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
      const { description, tags, projectId, canvaLink, linkOnly, assetType, folder } = req.body;
      
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
        const userId = (req.user as any).id;
        objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype
        ,
          (req.user as any).orgId
        );
      }

      const userId = (req.user as any).id;
      const moodboardData = isLinkOnly ? {
        projectId: validatedProjectId,
        assetType: assetType || 'moodboard',
        name: `Canva Design - ${new Date().toLocaleDateString()}`,
        description: description || null,
        folder: folder && typeof folder === 'string' ? folder.trim() : null,
        fileName: null,
        filePath: null,
        fileType: null,
        fileSize: null,
        tags: parsedTags,
        canvaLink: canvaLink.trim(),
        savedBy: userId,
      } : {
        projectId: validatedProjectId,
        assetType: assetType || 'moodboard',
        name: req.file!.originalname,
        description: description || null,
        folder: folder && typeof folder === 'string' ? folder.trim() : null,
        fileName: req.file!.originalname,
        filePath: objectPath, // Save object storage path instead of local path
        fileType: path.extname(req.file!.originalname).toLowerCase().substring(1), // Remove dot
        fileSize: req.file!.size.toString(), // Convert number to string for decimal schema
        tags: parsedTags,
        canvaLink: canvaLink && typeof canvaLink === 'string' ? canvaLink.trim() : null,
        savedBy: userId,
      };

      // Validate with Zod schema
      const validatedData = insertMoodboardSchema.parse(moodboardData);
      
      const moodboard = await storage.createMoodboard(validatedData);
      
      // Log activity (only for file uploads, not link-only)
      if (!isLinkOnly && req.file) {
        const userId = (req.user as any).id;
        const user = await storage.getUser(userId);
        if (user) {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          const moodboardUploadProject = validatedProjectId ? await storage.getProject(validatedProjectId) : null;
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: (assetType === 'render' ? 'render_upload' : assetType === 'working_drawing' ? 'working_drawing_upload' : 'moodboard_upload') as any,
            fileName: req.file.originalname,
            description: `uploaded ${assetType === 'render' ? 'render' : assetType === 'working_drawing' ? 'working drawing' : 'moodboard'}: ${req.file.originalname}`,
            projectId: validatedProjectId,
            metadata: { moodboardId: moodboard.id, assetType: moodboard.assetType, projectName: moodboardUploadProject?.projectName ?? null }
          });
        }
      }
      
      res.status(201).json(moodboard);
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
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
      
      // Allow updating name, description, tags, canvaLink, folder, roomType, and isLatestVersion
      const { name, description, tags, canvaLink, folder, roomType, isLatestVersion } = req.body;
      const updates: any = {};
      
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (isLatestVersion !== undefined) updates.isLatestVersion = Boolean(isLatestVersion);
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
      if (folder !== undefined) {
        updates.folder = folder && typeof folder === 'string' ? folder.trim() : null;
      }
      if (roomType !== undefined) {
        updates.roomType = roomType && typeof roomType === 'string' ? roomType.trim() : null;
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
      const userId = (req.user as any).id;
      
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
        const moodboardProject = moodboard.projectId ? await storage.getProject(moodboard.projectId) : null;
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
          metadata: { projectName: moodboardProject?.projectName ?? null },
        });
      }
      
      res.json({ message: "Moodboard deleted successfully" });
    } catch (error) {
      console.error('Error deleting moodboard:', error);
      res.status(500).json({ error: "Failed to delete moodboard" });
    }
  });

  // ==================== AI RENDER ROUTES ====================
  
  // Get available render styles
  app.get("/api/ai-renders/styles", requireAuth, async (req, res) => {
    try {
      res.json(RENDER_STYLES);
    } catch (error) {
      console.error('Error fetching render styles:', error);
      res.status(500).json({ error: "Failed to fetch render styles" });
    }
  });

  // Get catalogue items available for AI references (with images only)
  app.get("/api/ai-renders/catalogue-references", requireAdmin, async (req, res) => {
    try {
      const { mainCategory, subcategory, search } = req.query;
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
      
      // Get catalogue items - filter for those that might have usable images
      let items = await storage.getCatalogueItemsByCategory(
        mainCategory as string | undefined,
        subcategory as string | undefined
      );
      
      // Filter items that have an image path (either aiImagePath or filePath that's an image)
      items = items.filter(item => {
        // Check if has dedicated AI image
        if (item.aiImagePath) return true;
        
        // Check if fileName indicates an image file (filePath stores UUID path without extension)
        if (item.fileName && item.filePath) {
          const ext = item.fileName.split('.').pop()?.toLowerCase();
          return imageExtensions.includes(ext || '');
        }
        
        return false;
      });
      
      // Apply search filter if provided
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        items = items.filter(item => 
          item.mainCategory.toLowerCase().includes(searchLower) ||
          item.subcategory.toLowerCase().includes(searchLower) ||
          (item.vendorBrand?.toLowerCase().includes(searchLower)) ||
          (item.description?.toLowerCase().includes(searchLower)) ||
          (item.aiPromptHints?.toLowerCase().includes(searchLower))
        );
      }
      
      res.json(items);
    } catch (error) {
      console.error('Error fetching catalogue references:', error);
      res.status(500).json({ error: "Failed to fetch catalogue references" });
    }
  });

  // Generate AI render from uploaded image
  // Extended timeout for AI generation (5 minutes)
  app.post("/api/ai-renders/generate", requireAdmin, uploadAIRender.fields([
    { name: 'image', maxCount: 1 },
    { name: 'referencePhotos', maxCount: 5 }
  ]), async (req, res) => {
    // Set extended timeout for AI generation (5 minutes)
    req.setTimeout(300000);
    res.setTimeout(300000);
    
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const mainImageFile = files['image']?.[0];
      
      if (!mainImageFile) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const { styleId, customPrompt, referenceItems, referencePhotosMeta } = req.body;
      
      if (!styleId && !referenceItems) {
        return res.status(400).json({ error: "Style ID or reference items are required" });
      }
      
      // Parse reference items if provided as JSON string
      let parsedReferenceItems = undefined;
      if (referenceItems) {
        try {
          parsedReferenceItems = typeof referenceItems === 'string' 
            ? JSON.parse(referenceItems) 
            : referenceItems;
          
          // Validate reference items (max 3)
          if (Array.isArray(parsedReferenceItems) && parsedReferenceItems.length > 3) {
            return res.status(400).json({ error: "Maximum 3 reference items allowed" });
          }
          
          console.log("[AI Render] Processing", parsedReferenceItems?.length || 0, "reference items");
          
          // Enrich reference items by fetching images from their paths if imageData not provided
          for (const item of parsedReferenceItems) {
            if (!item.imageData && item.imagePath) {
              try {
                console.log(`[AI Render] Fetching image for reference item: ${item.name}`);
                const imageBuffer = await downloadObjectBuffer(item.imagePath);
                if (imageBuffer) {
                  // Detect mime type from path
                  const ext = item.imagePath.split('.').pop()?.toLowerCase();
                  const mimeTypeMap: Record<string, string> = {
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'png': 'image/png',
                    'gif': 'image/gif',
                    'webp': 'image/webp'
                  };
                  item.imageData = imageBuffer.toString('base64');
                  item.imageMimeType = mimeTypeMap[ext || 'jpg'] || 'image/jpeg';
                  console.log(`[AI Render] Loaded image for ${item.name}: ${item.imageData.length} bytes`);
                }
              } catch (imgErr) {
                console.error(`[AI Render] Failed to fetch image for ${item.name}:`, imgErr);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing reference items:', e);
          return res.status(400).json({ error: "Invalid reference items format" });
        }
      }
      
      // Process reference photos if provided
      const referencePhotoFiles = files['referencePhotos'] || [];
      let parsedRefPhotoMeta: Array<{ type: string; description: string }> = [];
      
      if (referencePhotosMeta) {
        try {
          parsedRefPhotoMeta = typeof referencePhotosMeta === 'string' 
            ? JSON.parse(referencePhotosMeta) 
            : referencePhotosMeta;
        } catch (e) {
          console.error('Error parsing reference photos metadata:', e);
        }
      }
      
      // Convert reference photos to base64 for AI processing
      const processedRefPhotos = referencePhotoFiles.map((file, index) => ({
        imageData: file.buffer.toString('base64'),
        mimeType: file.mimetype,
        type: parsedRefPhotoMeta[index]?.type || 'inspiration',
        description: parsedRefPhotoMeta[index]?.description || ''
      }));
      
      console.log("[AI Render] Processing", processedRefPhotos.length, "reference photos");
      
      // Convert main image file to base64
      const imageBase64 = mainImageFile.buffer.toString('base64');
      const mimeType = mainImageFile.mimetype;

      // Generate the render with optional reference items and reference photos
      const result = await generateInteriorRender(
        imageBase64, 
        mimeType, 
        styleId || 'modern', // Default style if using reference items only
        customPrompt,
        parsedReferenceItems,
        processedRefPhotos.length > 0 ? processedRefPhotos : undefined
      );
      
      // Return the generated image as base64
      res.json({
        success: true,
        imageData: result.imageData,
        mimeType: result.mimeType,
        referenceItemsUsed: parsedReferenceItems?.length || 0,
        referencePhotosUsed: processedRefPhotos.length
      });
    } catch (error: any) {
      console.error('Error generating AI render:', error);
      
      // Check for circuit breaker or service unavailable errors
      const isServiceUnavailable = error.name === 'CircuitBreakerError' || 
        error.message?.includes('temporarily unavailable') ||
        error.message?.includes('Too many recent failures') ||
        error.message?.includes('503') ||
        error.message?.includes('overloaded');
      
      if (isServiceUnavailable) {
        res.status(503).json({ 
          error: "AI service is temporarily busy. Please wait a moment and try again.",
          retryAfter: 60
        });
      } else {
        res.status(500).json({ error: error.message || "Failed to generate render" });
      }
    }
  });

  // Photoreal conversion endpoint — converts any render/image into a photorealistic version
  app.post("/api/ai-renders/photoreal", requireAdmin, uploadAIRender.single('image'), async (req, res) => {
    req.setTimeout(300000);
    res.setTimeout(300000);

    try {
      const imageFile = req.file;
      if (!imageFile) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const imageBase64 = imageFile.buffer.toString('base64');
      const mimeType = imageFile.mimetype;

      console.log("[Photoreal] Processing image, size:", imageFile.buffer.length, "bytes");

      const result = await generatePhotorealConversion(imageBase64, mimeType);

      res.json({
        success: true,
        imageData: result.imageData,
        mimeType: result.mimeType
      });
    } catch (error: any) {
      console.error('[Photoreal] Error:', error);

      const isServiceUnavailable = error.name === 'CircuitBreakerError' ||
        error.message?.includes('temporarily unavailable') ||
        error.message?.includes('Too many recent failures') ||
        error.message?.includes('503') ||
        error.message?.includes('overloaded');

      if (isServiceUnavailable) {
        res.status(503).json({
          error: "AI service is temporarily busy. Please wait a moment and try again.",
          retryAfter: 60
        });
      } else {
        res.status(500).json({ error: error.message || "Failed to convert to photoreal" });
      }
    }
  });

  // Generate AI render from text description (no image input)
  // Extended timeout for AI generation (5 minutes)
  app.post("/api/ai-renders/generate-from-description", requireAdmin, async (req, res) => {
    // Set extended timeout for AI generation (5 minutes)
    req.setTimeout(300000);
    res.setTimeout(300000);
    
    try {
      const { description, styleId } = req.body;
      
      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }
      
      if (!styleId) {
        return res.status(400).json({ error: "Style ID is required" });
      }
      
      // Generate the render from description
      const result = await generateConceptRender(description, styleId);
      
      res.json({
        success: true,
        imageData: result.imageData,
        mimeType: result.mimeType
      });
    } catch (error: any) {
      console.error('Error generating concept render:', error);
      
      // Check for circuit breaker or service unavailable errors
      const isServiceUnavailable = error.name === 'CircuitBreakerError' || 
        error.message?.includes('temporarily unavailable') ||
        error.message?.includes('Too many recent failures') ||
        error.message?.includes('503') ||
        error.message?.includes('overloaded');
      
      if (isServiceUnavailable) {
        res.status(503).json({ 
          error: "AI service is temporarily busy. Please wait a moment and try again.",
          retryAfter: 60
        });
      } else {
        res.status(500).json({ error: error.message || "Failed to generate render" });
      }
    }
  });

  // Save generated render to project moodboards
  app.post("/api/ai-renders/save", requireAdmin, async (req, res) => {
    try {
      const { imageData, mimeType, projectId, name, description, styleId, originalFilename, customName, roomType: explicitRoomType, referenceItems } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: "Image data is required" });
      }

      const userId = (req.user as any).id;
      
      // Extract room name from original filename (e.g., "Chitra's Bedroom" from "Chitra's bedroom 1.jpg")
      // Prefer custom name as source of room name (user types "Living room 3rd May")
      const roomName = extractRoomName(customName || originalFilename || name || '');
      
      // Detect room type for grouping: explicit selection > custom name > original filename > name
      // This ensures renders land in the correct room sub-group on the Renders page
      const roomTypeForGrouping = explicitRoomType || detectRoomType(customName || originalFilename || name || '');
      
      // Get style name from styleId
      const style = RENDER_STYLES.find(s => s.id === styleId);
      const styleName = style?.name || 'Custom';
      
      // Paraphrase the description/brief
      let paraphrasedDescription = styleName;
      if (description && description.trim()) {
        paraphrasedDescription = await paraphraseBrief(description, styleName);
      }
      
      // Use custom name if provided, otherwise generate display name
      // Custom name format: just use as-is
      // Auto-generated format: "{Room Name} - {Style} - {Paraphrased Brief}"
      let displayName: string;
      if (customName && customName.trim()) {
        displayName = customName.trim();
      } else if (description && description.trim()) {
        displayName = `${roomName} - ${styleName} - ${paraphrasedDescription}`;
      } else {
        displayName = `${roomName} - ${styleName}`;
      }
      
      // Convert base64 to buffer and upload to object storage
      const buffer = Buffer.from(imageData, 'base64');
      const extension = mimeType?.split('/')[1] || 'png';
      const fileName = `${roomName.replace(/\s+/g, '-').replace(/'/g, '')}-${styleName}-${Date.now()}.${extension}`;
      
      const objectPath = await uploadToObjectStorage(
        buffer,
        fileName,
        userId,
        mimeType || 'image/png'
      ,
        (req.user as any).orgId
      );

      // Validate projectId if provided
      let validatedProjectId = null;
      if (projectId && projectId !== 'general') {
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(400).json({ error: "Project not found" });
        }
        validatedProjectId = projectId;
      }

      // Build tags including reference item markers
      const baseTags: string[] = ['ai-generated', styleId, roomTypeForGrouping.toLowerCase().replace(/\s+/g, '-')];
      
      // Add reference item info to tags and build reference metadata for audit trail
      let referenceItemsDescription = '';
      let referenceMetadataForStorage: any[] | null = null;
      
      if (referenceItems && Array.isArray(referenceItems) && referenceItems.length > 0) {
        baseTags.push('catalogue-references');
        
        // Build detailed reference description for activity log
        const refDetails = referenceItems.map((r: any) => {
          const parts = [r.name];
          if (r.vendorBrand) parts.push(`(${r.vendorBrand})`);
          if (r.placementInstruction) parts.push(`- ${r.placementInstruction}`);
          return parts.join(' ');
        });
        referenceItemsDescription = ` with catalogue references: ${refDetails.join('; ')}`;
        
        // Add individual item IDs as tags for searchability
        referenceItems.forEach((r: any, idx: number) => {
          if (r.id) baseTags.push(`ref-${r.id}`);
        });
        
        // Store full reference metadata in dedicated field for reconstruction and auditing
        referenceMetadataForStorage = referenceItems.map((r: any) => ({
          catalogueId: r.id,
          name: r.name,
          category: r.category,
          subcategory: r.subcategory,
          vendorBrand: r.vendorBrand || null,
          description: r.description || null,
          aiPromptHints: r.aiPromptHints || null,
          imagePath: r.imagePath || null,
          placementInstruction: r.placementInstruction || null,
        }));
      }

      // Create moodboard entry as a render
      const moodboardData = {
        projectId: validatedProjectId,
        assetType: 'render' as const,
        name: displayName,
        description: paraphrasedDescription,
        fileName: fileName,
        filePath: objectPath,
        fileType: extension,
        fileSize: buffer.length.toString(),
        tags: baseTags,
        canvaLink: null,
        roomType: roomTypeForGrouping,
        referenceMetadata: referenceMetadataForStorage,
        savedBy: userId,
      };

      console.log('[AI Render Save] Creating moodboard with data:', {
        projectId: moodboardData.projectId,
        assetType: moodboardData.assetType,
        name: moodboardData.name,
        fileName: moodboardData.fileName,
        roomType: moodboardData.roomType,
      });
      
      const moodboard = await storage.createMoodboard(moodboardData);
      
      console.log('[AI Render Save] Moodboard created successfully:', {
        id: moodboard.id,
        assetType: moodboard.assetType,
        name: moodboard.name,
      });

      // Log activity with structured metadata for reference items
      const user = await storage.getUser(userId);
      if (user) {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || 'Unknown';
        
        // Build structured metadata for activity log
        const activityMetadata: Record<string, any> = {
          styleId: styleId,
          styleName: styleName,
          roomType: roomTypeForGrouping,
          moodboardId: moodboard.id,
        };
        
        // Add reference items to metadata for structured audit trail
        if (referenceMetadataForStorage && referenceMetadataForStorage.length > 0) {
          activityMetadata.referenceItems = referenceMetadataForStorage;
          activityMetadata.referenceCount = referenceMetadataForStorage.length;
        }

        if (validatedProjectId) {
          const renderProject = await storage.getProject(validatedProjectId);
          activityMetadata.projectName = renderProject?.projectName ?? null;
        }
        
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email || '',
          projectId: validatedProjectId || undefined,
          activityType: 'render' as any,
          fileName: fileName,
          filePath: objectPath,
          description: `created AI-generated render "${displayName}"${referenceItemsDescription}`,
          metadata: activityMetadata,
        });
      }

      res.status(201).json(moodboard);
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
      console.error('Error saving AI render:', error);
      res.status(500).json({ error: "Failed to save render" });
    }
  });

  // Task Management API Routes

  // Get all tasks across all projects
  app.get("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      // Use the same role-based project access as /api/projects so that tasks
      // are always in sync with what the user can see in the project list.
      // The old orgId INNER JOIN approach excluded projects with a null orgId
      // (created before multi-tenant was introduced), causing tasks to disappear.
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      const accessibleProjects = await storage.getProjectsForUser(userId, role);
      const projectIds = accessibleProjects.map((p: any) => p.id);
      const tasks = await storage.getAllTasksByProjectIds(projectIds);
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
      try {
        const userId = (req.user as any)?.id;
        const userRow = userId ? await storage.getUser(userId) : null;
        const userName = userRow ? (`${userRow.firstName || ''} ${userRow.lastName || ''}`.trim() || userRow.email) : 'Unknown';
        const project = task.projectId ? await storage.getProject(task.projectId) : null;
        await storage.createActivity({
          userId: userId || null, userName, userEmail: userRow?.email || '',
          projectId: task.projectId || null,
          activityType: 'task_create' as any,
          fileName: task.name, filePath: null,
          description: `Created task "${task.name}"${project ? ` in ${project.projectName}` : ''}`,
          metadata: { taskId: task.id, projectName: project?.projectName ?? null },
        } as any);
      } catch (actErr) { console.error('Activity log error (task_create):', actErr); }
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
  app.put("/api/tasks/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, ...bodyWithoutReason } = req.body;
      const validatedData = insertTaskSchema.partial().parse(bodyWithoutReason);
      const previousTask = await storage.getTask(id);
      const task = await storage.updateTask(id, validatedData);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      try {
        const userId = (req.user as any)?.id;
        const userRow = userId ? await storage.getUser(userId) : null;
        const userName = userRow ? (`${userRow.firstName || ''} ${userRow.lastName || ''}`.trim() || userRow.email) : 'Unknown';
        const project = task.projectId ? await storage.getProject(task.projectId) : null;
        const changes: string[] = [];
        if (validatedData.startDate && previousTask?.startDate !== validatedData.startDate)
          changes.push(`start date: ${previousTask?.startDate ?? 'none'} → ${validatedData.startDate}`);
        if (validatedData.endDate && previousTask?.endDate !== validatedData.endDate)
          changes.push(`end date: ${previousTask?.endDate ?? 'none'} → ${validatedData.endDate}`);
        let description = `Updated schedule for "${task.name}"`;
        if (changes.length) description += `: ${changes.join('; ')}`;
        if ((reason as string)?.trim()) description += `. Reason: ${(reason as string).trim()}`;
        await storage.createActivity({
          userId: userId || null, userName, userEmail: userRow?.email || '',
          projectId: task.projectId || null,
          activityType: 'task_date_update' as any,
          fileName: task.name, filePath: null, description,
          metadata: { taskId: id, changes: validatedData, previous: { startDate: previousTask?.startDate, endDate: previousTask?.endDate }, reason: (reason as string)?.trim() || null, projectName: project?.projectName ?? null },
        } as any);
      } catch (actErr) { console.error('Activity log error (task_date_update):', actErr); }
      res.json(task);
    } catch (error) {
      console.error('Error updating task:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Update task subcategory (admin and designer only)
  app.patch("/api/tasks/:id/subcategory", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      if (role === 'client') return res.status(403).json({ error: "Not authorised" });
      const { id } = req.params;
      const { subcategory } = req.body;
      const task = await storage.updateTask(id, { subcategory: subcategory ?? null });
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (error) {
      console.error('Error updating task subcategory:', error);
      res.status(500).json({ error: "Failed to update subcategory" });
    }
  });

  // Update task progress percentage (admin, designer, project_manager)
  app.patch("/api/tasks/:id/progress", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      if (role === 'client') return res.status(403).json({ error: "Not authorised" });
      const { id } = req.params;
      const { progressPercentage } = req.body;
      const pct = Number(progressPercentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: "progressPercentage must be between 0 and 100" });
      }
      // Auto-derive status from percentage
      let status: string | undefined;
      if (pct === 0) status = 'not_started';
      else if (pct >= 100) status = 'completed';
      else status = 'in_progress';
      const task = await storage.updateTask(id, { progressPercentage: String(pct), status });
      if (!task) return res.status(404).json({ error: "Task not found" });
      try {
        const userId = (req.user as any)?.id;
        const userRow = userId ? await storage.getUser(userId) : null;
        const userName = userRow ? (`${userRow.firstName || ''} ${userRow.lastName || ''}`.trim() || userRow.email) : 'Unknown';
        const project = task.projectId ? await storage.getProject(task.projectId) : null;
        await storage.createActivity({
          userId: userId || null, userName, userEmail: userRow?.email || '',
          projectId: task.projectId || null,
          activityType: 'task_progress_update' as any,
          fileName: task.name, filePath: null,
          description: `Updated progress for "${task.name}" to ${pct}%${pct >= 100 ? ' (completed)' : ''}`,
          metadata: { taskId: id, progressPercentage: pct, status, projectName: project?.projectName ?? null },
        } as any);
      } catch (actErr) { console.error('Activity log error (task_progress_update):', actErr); }
      res.json(task);
    } catch (error) {
      console.error('Error updating task progress:', error);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  // Bulk-complete a set of tasks (admin, designer, project_manager)
  app.patch("/api/tasks/bulk-complete", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      if (role === 'client') return res.status(403).json({ error: "Not authorised" });
      const { taskIds } = req.body;
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: "taskIds array required" });
      }
      const updated = await Promise.all(
        taskIds.map(id => storage.updateTask(id, { progressPercentage: '100', status: 'completed' }))
      );
      const completedCount = updated.filter(Boolean).length;
      try {
        const userId = (req.user as any)?.id;
        const userRow = userId ? await storage.getUser(userId) : null;
        const userName = userRow ? (`${userRow.firstName || ''} ${userRow.lastName || ''}`.trim() || userRow.email) : 'Unknown';
        await storage.createActivity({
          userId: userId || null, userName, userEmail: userRow?.email || '',
          projectId: null,
          activityType: 'task_bulk_complete' as any,
          fileName: `${completedCount} task${completedCount !== 1 ? 's' : ''}`, filePath: null,
          description: `Marked ${completedCount} task${completedCount !== 1 ? 's' : ''} as completed`,
          metadata: { taskIds, count: completedCount },
        } as any);
      } catch (actErr) { console.error('Activity log error (task_bulk_complete):', actErr); }
      res.json({ updated: completedCount });
    } catch (error) {
      console.error('Error bulk completing tasks:', error);
      res.status(500).json({ error: "Failed to bulk complete tasks" });
    }
  });

  // Update task remarks (open to any authenticated user, not just admin)
  app.patch("/api/tasks/:id/remarks", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { remarks } = req.body;
      const task = await storage.updateTask(id, { remarks: remarks ?? null });
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (error) {
      console.error('Error updating task remarks:', error);
      res.status(500).json({ error: "Failed to update remarks" });
    }
  });

  // Extend task deadline with reason (admin only) — records missed deadline history
  app.patch("/api/tasks/:id/extend-deadline", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { newEndDate, reason } = req.body;
      if (!newEndDate || !reason?.trim()) {
        return res.status(400).json({ error: "newEndDate and reason are required" });
      }

      const currentTask = await storage.getTask(id);
      if (!currentTask) return res.status(404).json({ error: "Task not found" });

      const userId = (req.user as any)?.id;
      const userRow = userId ? await storage.getUser(userId) : null;
      const extenderName = userRow ? `${userRow.firstName || ''} ${userRow.lastName || ''}`.trim() || userRow.email : 'Unknown';

      const previousDeadline = currentTask.endDate as string;
      const entry = {
        previousDeadline,
        newDeadline: newEndDate,
        reason: reason.trim(),
        extendedBy: userId || '',
        extendedByName: extenderName,
        extendedAt: new Date().toISOString(),
      };

      const existingHistory: typeof entry[] = Array.isArray((currentTask as any).deadlineHistory)
        ? (currentTask as any).deadlineHistory
        : [];
      const updatedHistory = [...existingHistory, entry];

      const task = await storage.updateTask(id, {
        endDate: newEndDate,
        deadlineHistory: updatedHistory as any,
      });

      // Also log to activity log
      const deadlineExtProject = currentTask.projectId ? await storage.getProject(currentTask.projectId) : null;
      await storage.createActivity({
        projectId: currentTask.projectId,
        userId: userId || null,
        activityType: 'schedule' as any,
        description: `Deadline extended for task "${currentTask.name}": ${previousDeadline} → ${newEndDate}. Reason: ${reason.trim()}`,
        metadata: { taskId: id, previousDeadline, newDeadline: newEndDate, reason: reason.trim(), projectName: deadlineExtProject?.projectName ?? null },
      } as any);

      res.json(task);
    } catch (error) {
      console.error('Error extending task deadline:', error);
      res.status(500).json({ error: "Failed to extend deadline" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const taskToDelete = await storage.getTask(id);
      const deleted = await storage.deleteTask(id);
      if (!deleted) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (taskToDelete) {
        try {
          const userId = (req.user as any)?.id;
          const userRow = userId ? await storage.getUser(userId) : null;
          const userName = userRow ? (`${userRow.firstName || ''} ${userRow.lastName || ''}`.trim() || userRow.email) : 'Unknown';
          const project = taskToDelete.projectId ? await storage.getProject(taskToDelete.projectId) : null;
          let description = `Deleted task "${taskToDelete.name}"`;
          if ((reason as string)?.trim()) description += `. Reason: ${(reason as string).trim()}`;
          await storage.createActivity({
            userId: userId || null, userName, userEmail: userRow?.email || '',
            projectId: taskToDelete.projectId || null,
            activityType: 'task_delete' as any,
            fileName: taskToDelete.name, filePath: null, description,
            metadata: { taskId: id, reason: (reason as string)?.trim() || null, projectName: project?.projectName ?? null },
          } as any);
        } catch (actErr) { console.error('Activity log error (task_delete):', actErr); }
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
      // Base timestamp so each row gets a unique +1ms createdAt offset —
      // prevents PostgreSQL now() ties which would make row order nondeterministic.
      const csvImportBaseTime = Date.now();
      
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
            rowIndex: i,
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

          // Validate with schema (omits createdAt — we add it explicitly below)
          const validatedData = insertTaskSchema.parse(taskData);
          // Stamp rowIndex and createdAt explicitly so insertion order is always
          // preserved even when PostgreSQL's now() resolves to the same millisecond
          // for consecutive inserts within a single import batch.
          const taskWithOrdering = {
            ...validatedData,
            rowIndex: i,
            createdAt: new Date(csvImportBaseTime + i),
          };
          const task = await storage.createTask(taskWithOrdering);
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
      
      // Get all tasks for this project (ordered by rowIndex to preserve original Excel sequence)
      const tasks = await storage.getTasksByProject(projectId);
      
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
        ['Olympik Design - Project Schedule Export'],
        [''],
        [`Project: ${project.projectName}`],
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
      const filename = `${(project.projectName || 'Project').replace(/[^a-z0-9]/gi, '_')}_Schedule_${new Date().toISOString().split('T')[0]}.xlsx`;
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
      const userId = (req.user as any).id;

      // Fetch schedule info before deletion so we can log it
      const schedule = await storage.getProjectSchedule(scheduleId);

      const deleted = await storage.deleteProjectSchedule(scheduleId);

      // Log the deletion activity only when the row was actually removed
      if (deleted && schedule) {
        try {
          const user = await storage.getUser(userId);
          if (user) {
            const userName = user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.email || 'Unknown';
            const scheduleProject = await storage.getProject(schedule.projectId);
            await storage.createActivity({
              userId: user.id,
              userName,
              userEmail: user.email || '',
              projectId: schedule.projectId,
              activityType: 'schedule_delete',
              fileName: schedule.fileName,
              description: `deleted schedule ${schedule.fileName} (v${schedule.version})`,
              metadata: {
                scheduleId: schedule.id,
                version: schedule.version,
                projectName: scheduleProject?.projectName ?? null,
              }
            });
          }
        } catch (activityError) {
          console.error('Error logging schedule deletion activity:', activityError);
        }
      }

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

      const userId = (req.user as any).id;
      
      // Snapshot existing schedule IDs BEFORE creating new data.
      // We delete old schedules AFTER the new import succeeds to prevent data loss
      // if the upload or task creation fails midway.
      const existingSchedules = await storage.getProjectSchedules(projectId);
      const oldScheduleIds = existingSchedules.map(s => s.id);

      // Upload file to object storage
      const filePath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      ,
          (req.user as any).orgId
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
        const scheduleUploadProject = await storage.getProject(projectId);
        await storage.createActivity({
          userId: user.id,
          userName: userName,
          userEmail: user.email || '',
          activityType: 'schedule_upload' as any,
          description: `Uploaded project schedule: ${req.file.originalname}`,
          fileName: req.file.originalname,
          projectId: projectId,
          metadata: { scheduleId: schedule.id, version: schedule.version, projectName: scheduleUploadProject?.projectName ?? null }
        });
      }

      // =============================================
      // ROBUST SCHEDULE IMPORT ENGINE
      // =============================================

      // Helper: case-insensitive column value lookup with whitespace/special char normalization
      const normalizeHeader = (h: string) => h.replace(/\u00A0/g, ' ').replace(/[\r\n]+/g, ' ').trim().toLowerCase();
      const getCol = (row: any, ...keys: string[]): any => {
        // First try exact key match
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
        }
        // Then try normalized case-insensitive match on all row keys
        const rowKeys = Object.keys(row);
        for (const key of keys) {
          const normalizedKey = normalizeHeader(key);
          const found = rowKeys.find(k => normalizeHeader(k) === normalizedKey);
          if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') return row[found];
        }
        return null;
      };

      // Robust date parser - handles many formats from Excel, MS Project, Google Sheets, etc.
      const parseDate = (dateValue: any): string | null => {
        if (dateValue === null || dateValue === undefined) return null;
        const raw = typeof dateValue === 'string' ? dateValue.replace(/\u00A0/g, ' ').trim() : dateValue;
        if (!raw && raw !== 0) return null;

        // Excel serial number (number like 45000 = a date)
        if (typeof raw === 'number' && raw > 1000 && raw < 200000) {
          const excelEpoch = new Date(Date.UTC(1899, 11, 30));
          const date = new Date(excelEpoch.getTime() + raw * 86400000);
          if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
        }

        if (typeof raw !== 'string') {
          // Date object
          if (raw instanceof Date && !isNaN(raw.getTime())) {
            return raw.toISOString().split('T')[0];
          }
          return null;
        }

        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        // DD/MM/YYYY or DD-MM-YYYY (common in India/UK)
        const ddmmyyyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmyyyy) {
          const [, d, m, y] = ddmmyyyy;
          const day = parseInt(d), month = parseInt(m), year = parseInt(y);
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
          }
        }

        // MM/DD/YYYY (US format) - try if day > 12 suggests it's actually DD/MM
        const mmddyyyy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (mmddyyyy) {
          const [, first, second, y] = mmddyyyy;
          const f = parseInt(first), s = parseInt(second), year = parseInt(y);
          // If first > 12, it must be DD/MM/YYYY (already handled above)
          // If second > 12, it must be MM/DD/YYYY
          if (f <= 12 && s > 12) {
            const date = new Date(year, f - 1, s);
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
          }
        }

        // DD Mon YYYY or DD-Mon-YYYY (e.g., "15 Jan 2025", "15-Jan-2025")
        const months: Record<string, number> = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
          january: 0, february: 1, march: 2, april: 3, june: 5,
          july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
        };
        const ddMonYyyy = raw.match(/^(\d{1,2})[\s\-]+([A-Za-z]+)[\s\-]+(\d{4})$/);
        if (ddMonYyyy) {
          const month = months[ddMonYyyy[2].toLowerCase()];
          if (month !== undefined) {
            const date = new Date(parseInt(ddMonYyyy[3]), month, parseInt(ddMonYyyy[1]));
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
          }
        }

        // Mon DD, YYYY (e.g., "Jan 15, 2025")
        const monDdYyyy = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
        if (monDdYyyy) {
          const month = months[monDdYyyy[1].toLowerCase()];
          if (month !== undefined) {
            const date = new Date(parseInt(monDdYyyy[3]), month, parseInt(monDdYyyy[2]));
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
          }
        }

        // YYYY/MM/DD
        const yyyymmdd = raw.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
        if (yyyymmdd) {
          const date = new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
          if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
        }

        // Last resort: try native Date parsing (handles ISO strings, etc.)
        try {
          const date = new Date(raw);
          if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2200) {
            return date.toISOString().split('T')[0];
          }
        } catch (e) { /* ignore */ }

        return null;
      };

      // Parse progress values from various formats
      const parseProgress = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') {
          if (value >= 0 && value <= 1) return Math.round(value * 100);
          return Math.min(100, Math.max(0, Math.round(value)));
        }
        const str = String(value).replace(/\u00A0/g, ' ').replace('%', '').trim().toLowerCase();
        if (str === 'completed' || str === 'complete' || str === 'done') return 100;
        if (str === 'incomplete' || str === 'pending' || str === 'not started' || str === '') return 0;
        const num = parseFloat(str);
        if (isNaN(num)) return 0;
        if (num >= 0 && num <= 1) return Math.round(num * 100);
        return Math.min(100, Math.max(0, Math.round(num)));
      };

      // Parse duration from various formats
      const parseDuration = (value: any): string | null => {
        if (value === null || value === undefined) return null;
        const str = String(value).trim();
        if (!str) return null;
        // Extract number (integer or decimal) from strings like "5 days", "1.5", "3d", "10 working days"
        const match = str.match(/([\d]+\.?[\d]*)/);
        if (match) {
          const num = parseFloat(match[1]);
          if (!isNaN(num) && num >= 0) return num.toFixed(2);
        }
        return null;
      };

      // ---- Parse file into raw rows ----
      let taskData: any[] = [];
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const workbook = XLSX.read(req.file.buffer);
        console.log(`[Schedule Import] Excel file sheets: ${workbook.SheetNames.join(', ')}`);
        
        // Find the best sheet: prioritize common schedule sheet names, skip Instructions
        const commonSheetPatterns = ['gantt', 'schedule', 'tasks', 'project schedule', 'timeline', 'data', 'sheet1'];
        let targetSheet = null;
        let usedSheetName = '';
        
        // Exact case-insensitive match first
        for (const pattern of commonSheetPatterns) {
          if (targetSheet) break;
          for (const sheetName of workbook.SheetNames) {
            if (sheetName.toLowerCase() === pattern) {
              targetSheet = workbook.Sheets[sheetName];
              usedSheetName = sheetName;
              break;
            }
          }
        }
        
        // Partial match (sheet name contains pattern)
        if (!targetSheet) {
          for (const pattern of commonSheetPatterns) {
            if (targetSheet) break;
            for (const sheetName of workbook.SheetNames) {
              if (sheetName.toLowerCase().includes(pattern)) {
                targetSheet = workbook.Sheets[sheetName];
                usedSheetName = sheetName;
                break;
              }
            }
          }
        }
        
        // Fallback: first non-Instructions sheet
        if (!targetSheet && workbook.SheetNames.length > 0) {
          for (const sn of workbook.SheetNames) {
            if (sn.toLowerCase() !== 'instructions') {
              targetSheet = workbook.Sheets[sn];
              usedSheetName = sn;
              break;
            }
          }
        }
        
        if (targetSheet) {
          console.log(`[Schedule Import] Using sheet: "${usedSheetName}"`);
          // raw: false converts Excel date serial numbers; defval ensures empty cells appear
          taskData = XLSX.utils.sheet_to_json(targetSheet, { defval: null, raw: false });
          
          // Auto-detect header row: if first row's values look like data headers, 
          // XLSX already handled it. If not (e.g., title row), try finding the real header.
          if (taskData.length > 0) {
            const firstRowKeys = Object.keys(taskData[0]);
            const looksLikeData = firstRowKeys.some(k => {
              const lk = normalizeHeader(k);
              return lk === 'name' || lk === 'task name' || lk === 'id' || lk === '#' || 
                     lk === 'start' || lk === 'finish' || lk === 'start date' || lk === 'end date' ||
                     lk === 'duration' || lk === 'status' || lk === '% complete';
            });
            
            if (!looksLikeData) {
              // Headers might be in a later row - try re-parsing with header detection
              console.log(`[Schedule Import] First row keys don't look like headers: ${firstRowKeys.join(', ')}`);
              console.log(`[Schedule Import] Attempting to auto-detect header row...`);
              
              // Scan first 10 rows looking for one that contains "Name" or "Task Name"
              const rawData: any[][] = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: null, raw: false });
              let headerRowIdx = -1;
              for (let r = 0; r < Math.min(rawData.length, 10); r++) {
                const rowVals = (rawData[r] || []).map((v: any) => normalizeHeader(String(v || '')));
                if (rowVals.some(v => v === 'name' || v === 'task name' || v === 'id')) {
                  headerRowIdx = r;
                  break;
                }
              }
              
              if (headerRowIdx >= 0) {
                console.log(`[Schedule Import] Found header row at index ${headerRowIdx}`);
                const headers = rawData[headerRowIdx].map((h: any) => String(h || '').trim());
                const dataRows = rawData.slice(headerRowIdx + 1);
                taskData = dataRows.map(row => {
                  const obj: any = {};
                  headers.forEach((h: string, idx: number) => {
                    if (h) obj[h] = row[idx] ?? null;
                  });
                  return obj;
                });
              }
            }
          }
          
          console.log(`[Schedule Import] Parsed ${taskData.length} data rows`);
        } else {
          console.log('[Schedule Import] No suitable sheet found. Available:', workbook.SheetNames);
        }
      } else if (fileExtension === 'csv') {
        const csvContent = req.file.buffer.toString('utf-8');
        const parseResult = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
        taskData = parseResult.data;
        console.log(`[Schedule Import] Parsed ${taskData.length} rows from CSV`);
      } else {
        return res.status(400).json({ error: "Unsupported file format. Use CSV or XLSX" });
      }

      if (taskData.length === 0) {
        return res.status(400).json({ 
          error: "No data rows found in the file. Make sure the file has column headers (Name, Start, Finish, etc.) and data rows below them." 
        });
      }

      // Log detected columns for debugging
      if (taskData.length > 0) {
        console.log(`[Schedule Import] Column headers: ${Object.keys(taskData[0]).join(', ')}`);
      }

      // ---- Import rows into database ----
      const createdTasks = [];
      const errors: Array<{ row: number; error: string }> = [];
      let skippedEmpty = 0;
      // Separate insertion index so blank/skipped rows don't consume rowIndex slots.
      // This ensures tasks are numbered 0, 1, 2... in insertion order, not by raw Excel row position.
      let rowInsertIndex = 0;
      const HEADER_PLACEHOLDER_DATE = '2099-12-31';
      // Base timestamp for explicit createdAt — each task gets +1ms offset so PostgreSQL's
      // now() ties are broken and insertion order is always preserved as the createdAt fallback.
      const importBaseTime = Date.now();
      
      for (let i = 0; i < taskData.length; i++) {
        const row: any = taskData[i];
        
        try {
          // Check if entire row is empty
          const allValues = Object.values(row);
          const isEmptyRow = allValues.every((v: any) => v === null || v === undefined || String(v).trim() === '');
          if (isEmptyRow) {
            skippedEmpty++;
            continue;
          }

          // Extract task name with broad column name support
          const rawName = getCol(row, 'Name', 'Task Name', 'Task name', 'task_name', 'Activity', 'Activity Name', 'Item', 'Description', 'Task');
          const name = rawName ? String(rawName).replace(/\u00A0/g, ' ').trim() : '';
          
          // Skip rows that are completely unnamed AND have no dates (truly empty content rows)
          if (!name) {
            const hasAnyDate = getCol(row, 'Start', 'Start Date', 'Finish', 'End', 'End Date') !== null;
            const hasAnyId = getCol(row, 'ID', 'id', '#') !== null;
            if (!hasAnyDate && !hasAnyId) {
              skippedEmpty++;
              continue;
            }
          }
          
          const finalName = name || `[Unnamed - Row ${i + 2}]`;
          const taskId = String(getCol(row, 'ID', 'id', '#', 'Sr No', 'S.No', 'Sl No', 'No.') ?? (i + 1));

          // Parse duration
          const durationString = parseDuration(getCol(row, 'Duration', 'duration', 'Days', 'Working Days'));
          
          // Parse status
          const statusValue = getCol(row, 'Status', 'status', 'Task Status') || '';
          const statusNormalized = String(statusValue).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          const isCompleted = ['completed', 'complete', 'done', 'finished', 'closed'].includes(statusNormalized);
          const isInProgress = ['in progress', 'in-progress', 'incomplete', 'ongoing', 'active', 'wip', 'started'].includes(statusNormalized);
          
          // Parse progress
          let progressNum = parseProgress(getCol(row, '% Complete', 'Progress', 'Percent Complete', 'Completion', '% Done'));
          if (isCompleted) progressNum = 100;
          const progressString = String(progressNum);
          
          // Map to internal status
          let taskStatus = 'not_started';
          if (isCompleted || progressNum >= 100) {
            taskStatus = 'completed';
          } else if (isInProgress || (progressNum > 0 && progressNum < 100)) {
            taskStatus = 'in_progress';
          }
          
          // Parse dates
          let startDate = parseDate(getCol(row, 'Start', 'Start Date', 'Begin', 'Begin Date', 'Planned Start'));
          let endDate = parseDate(getCol(row, 'Finish', 'End', 'End Date', 'Finish Date', 'Due', 'Due Date', 'Planned Finish', 'Planned End'));
          
          // Fallback: if end date missing but start + duration exist, calculate it
          if (startDate && !endDate && durationString) {
            const dur = parseFloat(durationString);
            if (!isNaN(dur) && dur > 0) {
              const start = new Date(startDate);
              start.setDate(start.getDate() + Math.ceil(dur));
              endDate = start.toISOString().split('T')[0];
            }
          }
          // If start missing but end date exists, use end date as start too
          if (!startDate && endDate) startDate = endDate;
          
          // Placeholder for rows without any dates
          startDate = startDate || HEADER_PLACEHOLDER_DATE;
          endDate = endDate || HEADER_PLACEHOLDER_DATE;

          // Parse optional fields with safe string conversion
          const safeStr = (val: any): string | null => {
            if (val === null || val === undefined) return null;
            const s = String(val).replace(/\u00A0/g, ' ').trim();
            return s || null;
          };

          const currentRowIndex = rowInsertIndex++;
          const taskRecord = {
            projectId,
            scheduleId: schedule.id,
            taskId,
            rowIndex: currentRowIndex,
            // Explicit createdAt with per-row +1ms offset so insertion order is always
            // preserved even when PostgreSQL's now() resolves to the same millisecond
            // for consecutive inserts — making createdAt a reliable sort tiebreaker.
            createdAt: new Date(importBaseTime + currentRowIndex),
            name: finalName,
            description: safeStr(getCol(row, 'Description', 'Remarks', 'Notes', 'Comments')) || '',
            startDate,
            endDate,
            duration: durationString,
            assignedTo: null,
            status: taskStatus,
            priority: 'medium' as const,
            progressPercentage: progressString,
            approvalRequired: String(getCol(row, 'Approval Required', 'Approval') || 'N').toUpperCase() === 'Y',
            materials: safeStr(getCol(row, 'Materials', 'Material', 'Resources')),
            owner: safeStr(getCol(row, 'Owner', 'Assigned To', 'Responsible', 'Resource Names')),
            targetStartDate: parseDate(getCol(row, 'Target Start', 'Baseline Start', 'Original Start')),
            targetEndDate: parseDate(getCol(row, 'Target Finish', 'Baseline Finish', 'Original Finish', 'Target End')),
            remarks: safeStr(getCol(row, 'Remarks', 'Notes', 'Comments')),
            outlineLevel: (() => { const v = getCol(row, 'Outline Level', 'Level', 'WBS Level', 'Indent'); const n = parseInt(String(v ?? '')); return isNaN(n) ? null : n; })(),
            color: safeStr(getCol(row, 'Color', 'Colour', 'Color Code')),
          };

          // Lightweight validation: ensure critical fields are valid before insert
          if (!taskRecord.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(taskRecord.startDate)) {
            taskRecord.startDate = HEADER_PLACEHOLDER_DATE;
          }
          if (!taskRecord.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(taskRecord.endDate)) {
            taskRecord.endDate = HEADER_PLACEHOLDER_DATE;
          }
          if (taskRecord.duration && isNaN(parseFloat(taskRecord.duration))) {
            taskRecord.duration = null;
          }
          if (isNaN(parseInt(taskRecord.progressPercentage))) {
            taskRecord.progressPercentage = '0';
          }
          if (!['not_started', 'in_progress', 'blocked', 'completed', 'overdue'].includes(taskRecord.status)) {
            taskRecord.status = 'not_started';
          }

          const task = await storage.createTask(taskRecord);
          createdTasks.push(task);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const shortMsg = errorMessage.length > 200 ? errorMessage.substring(0, 200) + '...' : errorMessage;
          console.error(`[Schedule Import] Row ${i + 2} failed: ${shortMsg}`);
          errors.push({ row: i + 2, error: shortMsg });
        }
      }

      console.log(`[Schedule Import] COMPLETE: ${createdTasks.length} created, ${errors.length} failed, ${skippedEmpty} empty rows skipped, ${taskData.length} total`);

      // Now that new import succeeded, delete the old schedules (and their tasks/dependencies)
      for (const oldId of oldScheduleIds) {
        try {
          await storage.deleteProjectSchedule(oldId);
        } catch (delErr) {
          console.error(`[Schedule Import] Failed to delete old schedule ${oldId}:`, delErr);
          // Non-fatal: new import already succeeded, old data just lingers
        }
      }
      
      res.status(201).json({
        message: `Imported ${createdTasks.length} of ${taskData.length} rows${skippedEmpty > 0 ? ` (${skippedEmpty} empty rows skipped)` : ''}${errors.length > 0 ? ` - ${errors.length} rows had errors` : ''}`,
        schedule,
        tasksCreated: createdTasks.length,
        tasksFailed: errors.length,
        skippedEmpty,
        totalRows: taskData.length,
        errors: errors.length > 0 ? errors.slice(0, 50) : undefined,
      });
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
      console.error('Error importing schedule:', error);
      res.status(500).json({ error: "Failed to import schedule" });
    }
  });

  // Download original schedule file
  app.get("/api/schedules/:scheduleId/download-original", requireAuth, async (req, res) => {
    try {
      const { scheduleId } = req.params;
      const userId = (req.user as any).id;
      
      const schedule = await storage.getProjectSchedule(scheduleId);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      if (!schedule.filePath) {
        return res.status(404).json({ error: "No file associated with this schedule" });
      }
      
      // Get project name for consistent filename
      let projectName = 'Project';
      if (schedule.projectId) {
        const project = await storage.getProject(schedule.projectId);
        if (project) {
          projectName = project.projectName;
        }
      }
      
      // Authorization check
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role;
      const isPrivilegedRole = role === 'admin' || role === 'designer';
      
      if (!isPrivilegedRole && schedule.projectId) {
        const assignments = await storage.getUserProjectAssignments(userId);
        const hasAccess = assignments.some(a => a.projectId === schedule.projectId);
        if (!hasAccess) {
          return res.status(403).json({ error: "Not authorized to access this schedule" });
        }
      }
      
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(schedule.filePath);
      
      // Set content disposition with consistent project-based filename
      const date = new Date().toISOString().split('T')[0];
      const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}-Designer_Schedule_${date}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error('Error downloading original schedule:', error);
      return res.status(500).json({ error: "Failed to download schedule" });
    }
  });

  // Designer Excel Export - Formatted schedule with colors and styling
  app.get("/api/schedules/:scheduleId/designer-export", requireAuth, async (req, res) => {
    try {
      const { scheduleId } = req.params;
      const userId = (req.user as any).id;
      
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
      
      // If no tasks in database, serve the original uploaded file directly
      // This ensures consistency between the "arrow" button and "Open" button
      if (tasks.length === 0 && schedule.filePath) {
        try {
          const objectStorageService = new ObjectStorageService();
          const objectFile = await objectStorageService.getObjectEntityFile(schedule.filePath);
          
          // Set content disposition with consistent project-based filename
          const projectName = project?.projectName || 'Project';
          const date = new Date().toISOString().split('T')[0];
          const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}-Designer_Schedule_${date}.xlsx`;
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          return objectStorageService.downloadObject(objectFile, res);
        } catch (error) {
          console.error('Error downloading original schedule file:', error);
          return res.status(404).json({ error: "Original schedule file not found" });
        }
      }
      
      // Create a new workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Olympik Design';
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
      
      // Sort tasks by rowIndex (original Excel row position) then createdAt as tiebreaker
      // rowIndex is dense (0-based) from import; createdAt preserves insertion batch order
      const sortedTasks = [...tasks].sort((a, b) => {
        const rowA = a.rowIndex !== null && a.rowIndex !== undefined ? a.rowIndex : Infinity;
        const rowB = b.rowIndex !== null && b.rowIndex !== undefined ? b.rowIndex : Infinity;
        if (rowA !== rowB) return rowA - rowB;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdA - createdB;
      });
      
      // Add data rows
      let seq = 1;
      let totalDataRows = 0;
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
        
        seq++;
        totalDataRows++;
        
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
        
        // Add dropdown data validation to Status cell (for non-phase rows)
        if (!isPhase && progressValue) {
          progressCell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"Incomplete,Completed"'],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Invalid Status',
            error: 'Please select either "Incomplete" or "Completed" from the dropdown.'
          };
        }
        
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
        to: { row: totalDataRows + 1, column: 6 }
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
        { topic: 'STATUS', description: 'The Status column has a dropdown toggle:' },
        { topic: '', description: '   • Click the dropdown arrow in any Status cell to toggle between options' },
        { topic: '', description: '   • "Incomplete" - Task is not yet done (default)' },
        { topic: '', description: '   • "Completed" - Task is finished' },
        { topic: '', description: '   • You can also type directly: "Incomplete" or "Completed"' },
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
      
      // Generate filename with consistent pattern (ProjectName-Designer_Schedule_date.xlsx)
      const projectName = project?.projectName || 'Project';
      const date = new Date().toISOString().split('T')[0];
      const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}-Designer_Schedule_${date}.xlsx`;
      
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
      const userId = (req.user as any).id;
      
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
      
      // Helper to safely get cell value
      const safeGetCell = (row: any, colIndex: number | undefined) => {
        if (!colIndex || colIndex < 1) return { value: null };
        try {
          return row.getCell(colIndex);
        } catch (e) {
          return { value: null };
        }
      };
      
      // Parse dates - handle Date objects, Excel serial numbers, and formatted strings
      const parseExcelDate = (cell: any): string | null => {
        const value = cell.value;
        if (!value) return null;
        
        if (value instanceof Date) {
          if (isNaN(value.getTime())) return null;
          return value.toISOString().split('T')[0];
        }
        
        if (typeof value === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + value * 86400 * 1000);
          if (isNaN(date.getTime())) return null;
          return date.toISOString().split('T')[0];
        }
        
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return null;
          
          const parsed = new Date(trimmed);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }
          
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
        if (value === null || value === undefined || value === '') return null;
        
        if (typeof value === 'string') {
          const trimmed = value.trim().toLowerCase();
          if (trimmed === 'completed' || trimmed === 'complete' || trimmed === 'done') return 100;
          if (trimmed === 'incomplete' || trimmed === 'pending' || trimmed === 'not started') return 0;
          
          const cleanValue = value.trim().replace('%', '');
          const num = parseFloat(cleanValue);
          if (!isNaN(num)) {
            if (num >= 0 && num <= 1) return Math.round(num * 100);
            return Math.min(100, Math.max(0, Math.round(num)));
          }
        }
        
        if (typeof value === 'number') {
          if (value >= 0 && value <= 1) return Math.round(value * 100);
          return Math.min(100, Math.max(0, Math.round(value)));
        }
        
        return null;
      };
      
      // Process rows and update tasks
      const updates: { id: string; changes: any }[] = [];
      const errors: string[] = [];
      
      worksheet.eachRow((row, rowNumber) => {
        try {
          if (rowNumber === 1) return;
          
          const dbIdCell = safeGetCell(row, columnMap.dbId);
          const dbId = dbIdCell.value?.toString();
          const rowScheduleId = safeGetCell(row, columnMap.scheduleId).value?.toString();
          
          if (!dbId || dbId === '') return;
          
          if (rowScheduleId && rowScheduleId !== scheduleId) {
            errors.push(`Row ${rowNumber}: Task belongs to a different schedule`);
            return;
          }
          
          const startDateCell = safeGetCell(row, columnMap.startDate);
          const endDateCell = safeGetCell(row, columnMap.endDate);
          const progressCell = safeGetCell(row, columnMap.progress);
          const remarksCell = safeGetCell(row, columnMap.remarks);
          
          const startDate = parseExcelDate(startDateCell);
          const endDate = parseExcelDate(endDateCell);
          const progressPercentage = parseProgress(progressCell);
          const remarks = remarksCell.value?.toString() || null;
          
          const changes: any = {};
          if (startDate) changes.startDate = startDate;
          if (endDate) changes.endDate = endDate;
          if (progressPercentage !== null) changes.progressPercentage = progressPercentage;
          if (remarks !== null) changes.remarks = remarks;
          
          if (Object.keys(changes).length > 0) {
            updates.push({ id: dbId, changes });
          }
        } catch (rowError) {
          console.error(`Error processing row ${rowNumber}:`, rowError);
          errors.push(`Row ${rowNumber}: Error processing row data`);
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
      
      const reimportProject = schedule.projectId ? await storage.getProject(schedule.projectId) : null;
      await storage.createActivity({
        userId,
        userName: userName,
        userEmail: user?.claims?.email || '',
        projectId: schedule.projectId,
        activityType: 'schedule_reimport' as any,
        fileName: schedule.originalFilename || 'schedule',
        description: `re-imported Designer Export: ${successCount} tasks updated, ${failCount} failed`,
        metadata: { scheduleId, successCount, failCount, projectName: reimportProject?.projectName ?? null },
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
      const userId = (req.user as any).id;
      
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
      const userId = (req.user as any).id;
      
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

  // Serve invoice PDF attachment directly
  app.get("/api/invoices/:id/attachment", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getVendorInvoice(id);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      if (!invoice.attachmentPath) return res.status(404).json({ error: "No attachment for this invoice" });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(invoice.attachmentPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving invoice attachment:", error);
      if (error instanceof ObjectNotFoundError) return res.status(404).json({ error: "File not found in storage" });
      res.status(500).json({ error: "Failed to retrieve attachment" });
    }
  });

  app.delete("/api/invoices/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any).id;
      
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
      const userId = (req.user as any).id;
      
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
      fileSize: 21 * 1024 * 1024, // 21MB limit for invoice PDFs
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

      const userId = (req.user as any).id;
      
      // Upload file to object storage
      const objectPath = await uploadToObjectStorage(
        req.file.buffer,
        req.file.originalname,
        userId,
        req.file.mimetype
      ,
          (req.user as any).orgId
        );

      res.json({ path: objectPath });
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
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

      const userId = (req.user as any).id;
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

  app.get("/api/catalogue/categories-with-image-counts", requireAdmin, async (req, res) => {
    try {
      const counts = await storage.getCategoriesWithImageCounts();
      res.json(counts);
    } catch (error) {
      console.error('Error fetching categories with counts:', error);
      res.status(500).json({ error: "Failed to fetch categories with counts" });
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
        ["2e0af0ad-4a41-4170-9fbe-22a3a6b21c80", "Electricals", "Automation", null, null, "Controllers, panels, scenes, protocols"],
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
      const user = req.user as any;
      if (user.orgId) await checkOrgLimit(user.orgId, 'catalogueItems');

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

      // Stamp orgId so per-org usage counts are correct (seed items have orgId = NULL)
      if (user.orgId) itemData.orgId = user.orgId;
      const validatedData = insertCatalogueItemSchema.parse(itemData);
      const item = await storage.createCatalogueItem(validatedData);
      
      // Log activity
      const actorUser = await storage.getUser(user.id);
      if (actorUser) {
        const userName = actorUser.firstName && actorUser.lastName 
          ? `${actorUser.firstName} ${actorUser.lastName}` 
          : actorUser.email || 'Unknown';
        const displayName = `${item.mainCategory} > ${item.subcategory}${item.vendorBrand ? ` (${item.vendorBrand})` : ''}`;
        await storage.createActivity({
          userId: actorUser.id,
          userName: userName,
          userEmail: actorUser.email,
          activityType: 'catalogue_upload',
          fileName: displayName,
          filePath: item.filePath || undefined,
          description: `uploaded catalogue item "${displayName}"`,
          metadata: { catalogueItemId: item.id }
        });
      }
      
      res.status(201).json(item);
    } catch (error: any) {
      if (error.limitExceeded) return res.status(403).json({ error: error.message, limitExceeded: true, current: error.current, limit: error.limit, resource: error.resource });
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
      
      // Strip orgId — catalogue item ownership is immutable via the API.
      const { orgId: _omitOrg, ...validatedUpdates } = insertCatalogueItemSchema.partial().parse(updates);
      const item = await storage.updateCatalogueItem(id, validatedUpdates);
      if (!item) {
        return res.status(404).json({ error: "Catalogue item not found" });
      }
      
      // Log activity
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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

  // ============== Object Assets Routes (Asset Ingestion) ==============
  // Import object asset processing functions
  const { detectObjectInImage, processObjectImage, generateTransparentVersion } = await import("./ai/gemini");
  
  // Configure multer for object asset uploads
  const objectAssetUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  // Get all object assets
  app.get("/api/object-assets", requireAdmin, async (req, res) => {
    try {
      const { type, status } = req.query;
      let assets;
      
      if (type) {
        assets = await storage.getObjectAssetsByType(type as string);
      } else if (status) {
        assets = await storage.getObjectAssetsByStatus(status as string);
      } else {
        assets = await storage.getAllObjectAssets();
      }
      
      res.json(assets);
    } catch (error) {
      console.error('Error fetching object assets:', error);
      res.status(500).json({ error: "Failed to fetch object assets" });
    }
  });

  // Get single object asset
  app.get("/api/object-assets/:id", requireAdmin, async (req, res) => {
    try {
      const asset = await storage.getObjectAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Object asset not found" });
      }
      res.json(asset);
    } catch (error) {
      console.error('Error fetching object asset:', error);
      res.status(500).json({ error: "Failed to fetch object asset" });
    }
  });

  // Upload and process object asset
  app.post("/api/object-assets/upload", requireAdmin, (req, res, next) => {
    objectAssetUpload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "Image file is required" });
        }

        const userId = (req.user as any).id;
        const userObjectType = req.body.objectType; // Optional: user can pre-select type
        
        // Upload original file to object storage
        const originalPath = await uploadToObjectStorage(
          req.file.buffer,
          `original_${req.file.originalname}`,
          userId,
          req.file.mimetype,
          (req.user as any).orgId
        );

        // Create initial asset record with pending status - NO auto-processing
        const asset = await storage.createObjectAsset({
          objectType: userObjectType || 'decor', // Default, will be updated by AI when processed
          originalFileName: req.file.originalname,
          originalFilePath: originalPath,
          processingStatus: 'pending', // Stays pending until user triggers processing
          uploadedBy: userId,
        });

        // Return immediately - user can trigger processing separately
        res.json({ 
          id: asset.id,
          status: 'pending',
          message: 'Asset uploaded successfully. Click "Process" to start AI processing.'
        });
        
        // NOTE: Processing is now triggered separately via POST /api/object-assets/:id/process

      } catch (error) {
        console.error('Error uploading object asset:', error);
        res.status(500).json({ error: "Failed to upload object asset" });
      }
    });
  });

  // Import AI editing functions
  const { applyProcessingInstructions, detectArtworkBoundingBox } = await import("./ai/gemini");

  // Background processing function - supports two modes:
  // 1. Analyze-only (no instructions): Just detect metadata, use original image
  // 2. AI-edit mode (with instructions): Apply AI-based edits following user instructions
  async function processAssetInBackground(
    assetId: string, 
    buffer: Buffer, 
    mimeType: string, 
    userObjectType?: string, 
    preserveHints?: string,
    processingInstructions?: string
  ) {
    try {
      // Update status to processing
      await storage.updateObjectAssetProcessing(assetId, { processingStatus: 'processing' });

      // Step 0: Auto-rotate based on EXIF orientation BEFORE AI analysis
      // This is critical for mobile photos which often have orientation metadata
      const sharp = (await import('sharp')).default;
      const rotatedBuffer = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .jpeg({ quality: 95 }) // Convert to standard format for consistent AI analysis
        .toBuffer();
      
      console.log('[Asset Processing] Auto-rotated image based on EXIF orientation');

      // Convert rotated buffer to base64 for AI
      const imageData = rotatedBuffer.toString('base64');
      const correctedMimeType = 'image/jpeg'; // Use JPEG for AI analysis

      // Step 1: Detect object type and get details (always happens)
      const detection = await detectObjectInImage(imageData, correctedMimeType);
      const objectType = userObjectType || detection.objectType;

      const asset = await storage.getObjectAsset(assetId);
      if (!asset) throw new Error('Asset not found');

      let processedBuffer: Buffer;
      let thumbnailBuffer: Buffer;
      let dimensions: { width: number; height: number };
      let processedPath: string | null = null;

      // Check if user has provided processing instructions for AI-based editing
      let aiEditingFailed = false;
      
      if (processingInstructions && processingInstructions.trim()) {
        const isCropAndCentre = processingInstructions.trim() === '__CROP_AND_CENTRE__';

        if (isCropAndCentre) {
          // ── Pixel-perfect crop using sharp (no AI image generation) ──────────
          console.log('[Asset Processing] Crop & Centre mode: detecting artwork bbox then cropping with sharp');
          
          const bbox = await detectArtworkBoundingBox(imageData, correctedMimeType);
          
          if (bbox) {
            const meta = await sharp(rotatedBuffer).metadata();
            const imgW = meta.width || 1;
            const imgH = meta.height || 1;

            // Step 1: Gemini bbox crop with 2% padding so the frame is never clipped
            const padX = Math.round(imgW * 0.02);
            const padY = Math.round(imgH * 0.02);
            const left   = Math.max(0,    Math.round(imgW * bbox.leftPct   / 100) - padX);
            const top    = Math.max(0,    Math.round(imgH * bbox.topPct    / 100) - padY);
            const right  = Math.min(imgW, Math.round(imgW * bbox.rightPct  / 100) + padX);
            const bottom = Math.min(imgH, Math.round(imgH * bbox.bottomPct / 100) + padY);

            const cropWidth  = Math.max(1, right - left);
            const cropHeight = Math.max(1, bottom - top);

            console.log(`[Asset Processing] Cropping: left=${left}, top=${top}, width=${cropWidth}, height=${cropHeight}`);

            // Step 2: Trim uniform-coloured wall/background from edges automatically.
            // sharp.trim() removes edge pixels whose colour matches the corner sample
            // within a threshold — precisely removes remaining wall without touching the frame.
            const coarseCrop = await sharp(rotatedBuffer)
              .extract({ left, top, width: cropWidth, height: cropHeight })
              .jpeg({ quality: 95 })
              .toBuffer();

            const trimmedBuffer = await sharp(coarseCrop)
              .trim({ threshold: 15 })
              .jpeg({ quality: 95 })
              .toBuffer();

            processedBuffer = trimmedBuffer;
            const trimMeta = await sharp(trimmedBuffer).metadata();
            dimensions = { width: trimMeta.width || cropWidth, height: trimMeta.height || cropHeight };

            processedPath = await uploadToObjectStorage(
              processedBuffer,
              `processed_${asset.originalFileName}`,
              asset.uploadedBy,
              'image/jpeg'
            );
            console.log('[Asset Processing] Crop & Centre complete — pixel-perfect crop applied');
          } else {
            aiEditingFailed = true;
            throw new Error('Could not detect artwork bounds — please try again');
          }
        } else {
          // ── General AI image editing ──────────────────────────────────────────
          console.log('[Asset Processing] Using AI-based editing with instructions:', processingInstructions);
          
          const aiResult = await applyProcessingInstructions(
            imageData,
            correctedMimeType,
            processingInstructions,
            detection.description
          );

          if (aiResult.processedData && aiResult.dimensions) {
            processedBuffer = Buffer.from(aiResult.processedData, 'base64');
            dimensions = aiResult.dimensions;
            console.log('[Asset Processing] AI editing successful');
            
            processedPath = await uploadToObjectStorage(
              processedBuffer,
              `processed_${asset.originalFileName}`,
              asset.uploadedBy,
              'image/png'
            );
          } else {
            console.log('[Asset Processing] AI editing failed - will report error to user');
            aiEditingFailed = true;
            throw new Error('AI editing failed - please try again with different instructions');
          }
        }

        // Create thumbnail from the processed image
        thumbnailBuffer = await sharp(processedBuffer)
          .resize(256, 256, { fit: 'cover' })
          .png({ quality: 80 })
          .toBuffer();
      } else {
        // ANALYZE-ONLY MODE: No processing instructions provided
        // Keep the original image as-is, just get metadata and create thumbnail
        console.log('[Asset Processing] Analyze-only mode - preserving original image');
        
        // Get dimensions from the rotated buffer
        const metadata = await sharp(rotatedBuffer).metadata();
        dimensions = { width: metadata.width || 0, height: metadata.height || 0 };
        
        // processedPath stays null - originalFilePath already contains the uploaded image
        // We don't modify the image at all in analyze-only mode
        processedBuffer = rotatedBuffer; // Only used for thumbnail generation
        
        // Create thumbnail from original image
        thumbnailBuffer = await sharp(rotatedBuffer)
          .resize(256, 256, { fit: 'cover' })
          .png({ quality: 80 })
          .toBuffer();
      }

      // Upload thumbnail
      const thumbnailPath = await uploadToObjectStorage(
        thumbnailBuffer,
        `thumb_${asset.originalFileName}`,
        asset.uploadedBy,
        'image/png'
      );

      // Step 4: Try to generate transparent version only if AI editing was used AND instructions included transparent
      // This only runs in AI-edit mode (when processedPath is set), not in analyze-only mode
      let transparentPath: string | undefined;
      if (processedPath && processingInstructions && processingInstructions.toLowerCase().includes('transparent')) {
        try {
          const processedBase64 = processedBuffer.toString('base64');
          const transparentData = await generateTransparentVersion(processedBase64, 'image/png', detection.description);
          if (transparentData) {
            const transparentBuffer = Buffer.from(transparentData, 'base64');
            transparentPath = await uploadToObjectStorage(
              transparentBuffer,
              `transparent_${asset.originalFileName}`,
              asset.uploadedBy,
              'image/png'
            );
          }
        } catch (e) {
          console.log('Transparent version not generated:', e);
        }
      }

      // Step 5: Update asset with all processing results
      // If preserveHints is provided (user edited), keep it; otherwise use AI-generated hints
      const updateData: any = {
        processingStatus: 'completed',
        thumbnailPath: thumbnailPath,
        detectedBounds: detection.boundingBox,
        dimensions: dimensions,
        aiDescription: detection.description,
        aiPromptHints: preserveHints || detection.aiPromptHints,
        processedAt: new Date(),
      };
      
      // Only set processedFilePath if we actually processed the image (not analyze-only)
      if (processedPath) {
        updateData.processedFilePath = processedPath;
      }
      if (transparentPath) {
        updateData.transparentPath = transparentPath;
      }
      
      await storage.updateObjectAssetProcessing(assetId, updateData);

      // Also update the object type if it was detected
      if (!userObjectType) {
        await storage.updateObjectAsset(assetId, { objectType: detection.objectType });
      }

      console.log(`[Asset Processing] Completed for asset ${assetId}`);
    } catch (error) {
      console.error(`[Asset Processing] Failed for asset ${assetId}:`, error);
      await storage.updateObjectAssetProcessing(assetId, {
        processingStatus: 'failed',
        processingError: error instanceof Error ? error.message : 'Processing failed',
      });
    }
  }

  // Process a pending asset (initial processing after upload)
  // Body can include: { objectType?, processingInstructions? }
  // If no processingInstructions provided, just analyzes the image without modifying it
  app.post("/api/object-assets/:id/process", requireAdmin, async (req, res) => {
    try {
      const asset = await storage.getObjectAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Object asset not found" });
      }

      if (asset.processingStatus !== 'pending') {
        return res.status(400).json({ error: "Asset is not in pending state. Use reprocess for completed or failed assets." });
      }

      // Download original file from object storage
      const originalBuffer = await downloadObjectBuffer(asset.originalFilePath);

      // Get processing instructions from request body
      const processingInstructions = req.body.processingInstructions || undefined;

      // Update status to processing
      await storage.updateObjectAssetProcessing(asset.id, { 
        processingStatus: 'processing'
      });

      const hasInstructions = !!processingInstructions;
      res.json({ 
        message: hasInstructions ? 'AI processing started with instructions' : 'Analysis started (original image preserved)',
        mode: hasInstructions ? 'ai-edit' : 'analyze-only'
      });

      // Start async processing
      const mimeType = asset.originalFileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      processAssetInBackground(
        asset.id, 
        originalBuffer, 
        mimeType, 
        req.body.objectType,
        undefined,
        processingInstructions
      ).catch(error => {
        console.error('Processing failed:', error);
      });

    } catch (error) {
      console.error('Error processing object asset:', error);
      res.status(500).json({ error: "Failed to process object asset" });
    }
  });

  // Reprocess an asset (retry failed or update with new instructions)
  // Body can include: { objectType?, processingInstructions? }
  app.post("/api/object-assets/:id/reprocess", requireAdmin, async (req, res) => {
    try {
      const asset = await storage.getObjectAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Object asset not found" });
      }

      // Download original file from object storage
      const originalBuffer = await downloadObjectBuffer(asset.originalFilePath);

      // Get processing instructions from request body (priority) or stored in asset
      const processingInstructions = req.body.processingInstructions || (asset as any).processingInstructions || undefined;

      // Reset status, increment reprocess count, and start reprocessing
      const currentCount = asset.reprocessCount || 0;
      await storage.updateObjectAssetProcessing(asset.id, { 
        processingStatus: 'pending',
        processingError: undefined,
        reprocessCount: currentCount + 1
      });

      const hasInstructions = !!processingInstructions;
      res.json({ 
        message: hasInstructions ? 'Reprocessing started with AI instructions' : 'Reprocessing started (original image preserved)', 
        reprocessCount: currentCount + 1,
        mode: hasInstructions ? 'ai-edit' : 'analyze-only'
      });

      // Start async processing - preserve user-edited hints
      const mimeType = asset.originalFileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      processAssetInBackground(
        asset.id, 
        originalBuffer, 
        mimeType, 
        req.body.objectType, 
        asset.aiPromptHints || undefined,
        processingInstructions
      ).catch(error => {
        console.error('Reprocessing failed:', error);
      });

    } catch (error) {
      console.error('Error reprocessing object asset:', error);
      res.status(500).json({ error: "Failed to reprocess object asset" });
    }
  });

  // Update object asset metadata
  app.put("/api/object-assets/:id", requireAdmin, async (req, res) => {
    try {
      const { userDescription, objectType, aiPromptHints, processingInstructions } = req.body;
      
      const updates: any = {};
      if (userDescription !== undefined) updates.userDescription = userDescription;
      if (objectType) updates.objectType = objectType;
      if (aiPromptHints !== undefined) updates.aiPromptHints = aiPromptHints;
      if (processingInstructions !== undefined) updates.processingInstructions = processingInstructions;

      const asset = await storage.updateObjectAsset(req.params.id, updates);
      if (!asset) {
        return res.status(404).json({ error: "Object asset not found" });
      }

      res.json(asset);
    } catch (error) {
      console.error('Error updating object asset:', error);
      res.status(500).json({ error: "Failed to update object asset" });
    }
  });

  // Delete object asset
  app.delete("/api/object-assets/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteObjectAsset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Object asset not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting object asset:', error);
      res.status(500).json({ error: "Failed to delete object asset" });
    }
  });

  // Process with AI and save directly to saved assets (without modifying original)
  // This creates a new saved asset from the AI-processed result while keeping original unchanged
  app.post("/api/object-assets/:id/process-and-save", requireAdmin, async (req, res) => {
    try {
      const asset = await storage.getObjectAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Object asset not found" });
      }

      const { processingInstructions, displayName, description, tags } = req.body;
      
      if (!processingInstructions || !processingInstructions.trim()) {
        return res.status(400).json({ error: "Processing instructions are required" });
      }

      if (!displayName || !displayName.trim()) {
        return res.status(400).json({ error: "Display name is required" });
      }

      // Download original file from object storage
      const originalBuffer = await downloadObjectBuffer(asset.originalFilePath);

      // Auto-rotate based on EXIF orientation
      const sharp = (await import('sharp')).default;
      const rotatedBuffer = await sharp(originalBuffer)
        .rotate()
        .jpeg({ quality: 95 })
        .toBuffer();

      const imageData = rotatedBuffer.toString('base64');
      const mimeType = 'image/jpeg';

      // Apply AI processing
      const aiResult = await applyProcessingInstructions(
        imageData,
        mimeType,
        processingInstructions,
        asset.aiDescription || ''
      );

      if (!aiResult.processedData || !aiResult.dimensions) {
        return res.status(500).json({ error: "AI processing failed - please try different instructions" });
      }

      // Upload processed image
      const processedBuffer = Buffer.from(aiResult.processedData, 'base64');
      const processedPath = await uploadToObjectStorage(
        processedBuffer,
        `saved_${Date.now()}_${asset.originalFileName}`,
        asset.uploadedBy,
        'image/png'
      );

      // Generate thumbnail
      const thumbnailBuffer = await sharp(processedBuffer)
        .resize(256, 256, { fit: 'cover' })
        .png({ quality: 80 })
        .toBuffer();
      
      const thumbnailPath = await uploadToObjectStorage(
        thumbnailBuffer,
        `saved_thumb_${Date.now()}_${asset.originalFileName}`,
        asset.uploadedBy,
        'image/png'
      );

      // Create saved asset
      const savedAsset = await storage.createSavedAsset({
        displayName: displayName.trim(),
        description: description || asset.aiDescription,
        tags: tags,
        filePath: processedPath,
        thumbnailPath: thumbnailPath,
        sourceType: 'object_asset',
        objectAssetId: asset.id,
        aiPromptHints: asset.aiPromptHints,
        createdBy: asset.uploadedBy
      });

      res.json({ 
        message: 'Processed and saved successfully',
        savedAsset 
      });

    } catch (error) {
      console.error('Error in process-and-save:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process and save" });
    }
  });

  // Save asset to catalogue
  app.post("/api/object-assets/:id/save-to-catalogue", requireAdmin, async (req, res) => {
    try {
      const asset = await storage.getObjectAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Object asset not found" });
      }

      if (asset.processingStatus !== 'completed') {
        return res.status(400).json({ error: "Asset must be fully processed before saving to catalogue" });
      }

      const { mainCategory, subcategory, vendorBrand, description, attributes } = req.body;

      if (!mainCategory || !subcategory) {
        return res.status(400).json({ error: "Category and subcategory are required" });
      }

      // Enforce catalogue item plan limit before creation.
      const callerOrgId = (req.user as any).orgId;
      if (callerOrgId) await checkOrgLimit(callerOrgId, 'catalogueItems');

      const catalogueItem = await storage.createCatalogueItem({
        mainCategory,
        subcategory,
        vendorBrand: vendorBrand || null,
        description: description || asset.aiDescription || null,
        attributes: attributes || '',
        aiImagePath: asset.processedFilePath || asset.originalFilePath,
        aiPromptHints: asset.aiPromptHints || null,
        orgId: callerOrgId || null,
      });

      // Link the asset to the catalogue item
      await storage.linkAssetToCatalogue(asset.id, catalogueItem.id);

      // Log activity
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      if (user) {
        await storage.createActivity({
          userId: user.id,
          userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown',
          userEmail: user.email || '',
          activityType: 'catalogue_upload',
          fileName: `${mainCategory} > ${subcategory}`,
          filePath: asset.processedFilePath || asset.originalFilePath,
          description: `added object asset to catalogue: ${mainCategory} > ${subcategory}`,
          metadata: { catalogueItemId: catalogueItem.id, objectAssetId: asset.id }
        });
      }

      res.json({ catalogueItem, asset });
    } catch (error) {
      console.error('Error saving asset to catalogue:', error);
      res.status(500).json({ error: "Failed to save asset to catalogue" });
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
        const userId = (req.user as any).id;
        const objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype
        ,
          (req.user as any).orgId
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
      } catch (error: any) {
        if (handleLimitError(res, error)) return;
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

      if (req.file) {
        const userId = (req.user as any).id;
        const objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype,
          (req.user as any).orgId
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
      const userId = (req.user as any).id;
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

  // ─── SOP Routes ────────────────────────────────────────────────────────────
  const sopUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.get("/api/sops", requireAuth, async (req, res) => {
    try {
      const data = await storage.getAllSops();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SOPs" });
    }
  });

  app.get("/api/sops/categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getSopCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SOP categories" });
    }
  });

  app.get("/api/sops/:id", requireAuth, async (req, res) => {
    try {
      const sop = await storage.getSop(req.params.id);
      if (!sop) return res.status(404).json({ error: "SOP not found" });
      res.json(sop);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SOP" });
    }
  });

  app.post("/api/sops", requireProjectManagerOrAdmin, sopUpload.single('file'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      let fileName: string | undefined;
      let filePath: string | undefined;

      if (req.file) {
        const { uploadFile } = await import("./objectStorage");
        const ext = req.file.originalname.split('.').pop() || 'bin';
        const key = `.private/sops/${Date.now()}_${req.file.originalname}`;
        await uploadFile(key, req.file.buffer, req.file.mimetype);
        fileName = req.file.originalname;
        filePath = key;
      }

      const sop = await storage.createSop({
        title: req.body.title,
        category: req.body.category,
        description: req.body.description || null,
        content: req.body.content || null,
        fileName: fileName || null,
        filePath: filePath || null,
        createdBy: userId,
      });
      res.status(201).json(sop);
    } catch (error) {
      console.error("Error creating SOP:", error);
      res.status(500).json({ error: "Failed to create SOP" });
    }
  });

  app.put("/api/sops/:id", requireProjectManagerOrAdmin, sopUpload.single('file'), async (req, res) => {
    try {
      const existing = await storage.getSop(req.params.id);
      if (!existing) return res.status(404).json({ error: "SOP not found" });

      let fileName = existing.fileName;
      let filePath = existing.filePath;

      if (req.file) {
        const { uploadFile } = await import("./objectStorage");
        const key = `.private/sops/${Date.now()}_${req.file.originalname}`;
        await uploadFile(key, req.file.buffer, req.file.mimetype);
        fileName = req.file.originalname;
        filePath = key;
      }

      const updated = await storage.updateSop(req.params.id, {
        title: req.body.title,
        category: req.body.category,
        description: req.body.description || null,
        content: req.body.content || null,
        fileName,
        filePath,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating SOP:", error);
      res.status(500).json({ error: "Failed to update SOP" });
    }
  });

  app.delete("/api/sops/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteSop(req.params.id);
      if (!deleted) return res.status(404).json({ error: "SOP not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SOP" });
    }
  });

  app.get("/api/sops/:id/download", requireAuth, async (req, res) => {
    try {
      const sop = await storage.getSop(req.params.id);
      if (!sop || !sop.filePath) return res.status(404).json({ error: "File not found" });
      const { downloadFile } = await import("./objectStorage");
      const fileBuffer = await downloadFile(sop.filePath);
      res.setHeader("Content-Disposition", `attachment; filename="${sop.fileName || 'download'}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(fileBuffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });
  // ────────────────────────────────────────────────────────────────────────────

  // Saved Assets Routes - Admin/Designer only
  app.get("/api/saved-assets", requireAdmin, async (req, res) => {
    try {
      const assets = await storage.getAllSavedAssets();
      res.json(assets);
    } catch (error) {
      console.error('Error fetching saved assets:', error);
      res.status(500).json({ error: "Failed to fetch saved assets" });
    }
  });

  app.get("/api/saved-assets/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const asset = await storage.getSavedAsset(id);
      if (!asset) {
        return res.status(404).json({ error: "Saved asset not found" });
      }
      res.json(asset);
    } catch (error) {
      console.error('Error fetching saved asset:', error);
      res.status(500).json({ error: "Failed to fetch saved asset" });
    }
  });

  app.post("/api/saved-assets", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { displayName, description, tags, filePath, thumbnailPath, sourceType, objectAssetId, catalogueItemId, aiPromptHints } = req.body;
      
      if (!displayName || !filePath || !sourceType) {
        return res.status(400).json({ error: "displayName, filePath, and sourceType are required" });
      }

      const asset = await storage.createSavedAsset({
        displayName,
        description: description || null,
        tags: tags || null,
        filePath,
        thumbnailPath: thumbnailPath || null,
        sourceType,
        objectAssetId: objectAssetId || null,
        catalogueItemId: catalogueItemId || null,
        aiPromptHints: aiPromptHints || null,
        savedBy: userId,
      });

      res.status(201).json(asset);
    } catch (error) {
      console.error('Error creating saved asset:', error);
      res.status(500).json({ error: "Failed to create saved asset" });
    }
  });

  app.patch("/api/saved-assets/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { displayName, description, tags, aiPromptHints } = req.body;
      
      const asset = await storage.updateSavedAsset(id, {
        displayName,
        description,
        tags,
        aiPromptHints,
      });

      if (!asset) {
        return res.status(404).json({ error: "Saved asset not found" });
      }

      res.json(asset);
    } catch (error) {
      console.error('Error updating saved asset:', error);
      res.status(500).json({ error: "Failed to update saved asset" });
    }
  });

  app.delete("/api/saved-assets/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSavedAsset(id);
      if (!deleted) {
        return res.status(404).json({ error: "Saved asset not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting saved asset:', error);
      res.status(500).json({ error: "Failed to delete saved asset" });
    }
  });

  // Save a generated AI render directly to Saved Assets (for iterative workflows)
  app.post("/api/ai-renders/save-to-assets", requireAdmin, async (req, res) => {
    try {
      const { imageData, mimeType, displayName, description, aiPromptHints } = req.body;
      if (!imageData) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const userId = (req.user as any).id;
      const ext = (mimeType || 'image/png').split('/')[1] || 'png';
      const fileName = `ai-render-${Date.now()}.${ext}`;
      const buffer = Buffer.from(imageData, 'base64');
      const objectPath = await uploadToObjectStorage(buffer, fileName, userId, mimeType || 'image/png', (req.user as any).orgId);
      const name = (displayName && displayName.trim()) ? displayName.trim() : `AI Render ${new Date().toLocaleString()}`;
      const asset = await storage.createSavedAsset({
        displayName: name,
        description: description || null,
        tags: 'ai-render',
        filePath: objectPath,
        thumbnailPath: null,
        sourceType: 'ai_render',
        objectAssetId: null,
        catalogueItemId: null,
        aiPromptHints: aiPromptHints || description || null,
        savedBy: userId,
      });
      res.json(asset);
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
      console.error('Error saving render to assets:', error);
      res.status(500).json({ error: "Failed to save render to assets" });
    }
  });

  // Configure multer for meeting minutes file uploads
  const meetingMinutesUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
  });

  // Meeting Minutes Routes - Admin/Designer/Project Manager
  app.get("/api/meeting-minutes", requireProjectAccess, async (req, res) => {
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

  app.post("/api/meeting-minutes", requireProjectAccess, (req, res, next) => {
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
        const userId = (req.user as any).id;
        const objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype
        ,
          (req.user as any).orgId
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
          source: req.body.source || 'manual',
        };

        const minutes = await storage.createMeetingMinutes(momData);

        // Log activity
        const user = await storage.getUser(userId);
        if (user) {
          try {
            const userName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.email || 'Unknown';
            const momUploadProject = req.body.projectId ? await storage.getProject(req.body.projectId) : null;
            await storage.createActivity({
              userId: user.id,
              userName: userName,
              userEmail: user.email || '',
              activityType: 'meeting_minutes_upload',
              fileName: req.file.originalname,
              filePath: objectPath,
              projectId: req.body.projectId || null,
              description: `uploaded meeting minutes: ${req.body.meetingTitle} (${req.body.meetingType})`,
              metadata: {
                momId: minutes.id,
                meetingDate: req.body.meetingDate,
                meetingType: req.body.meetingType,
                projectId: req.body.projectId,
                projectName: momUploadProject?.projectName ?? null,
              },
            });
          } catch (activityError) {
            console.error('Error logging meeting minutes activity:', activityError);
          }
        }

        res.status(201).json(minutes);
      } catch (error: any) {
        if (handleLimitError(res, error)) return;
        console.error('Error creating meeting minutes:', error);
        res.status(500).json({ error: "Failed to create meeting minutes" });
      }
    });
  });

  app.put("/api/meeting-minutes/:id", requireProjectAccess, meetingMinutesUpload.single('file'), async (req, res) => {
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

      if (req.file) {
        const userId = (req.user as any).id;
        const objectPath = await uploadToObjectStorage(
          req.file.buffer,
          req.file.originalname,
          userId,
          req.file.mimetype,
          (req.user as any).orgId
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
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
      console.error('Error updating meeting minutes:', error);
      res.status(500).json({ error: "Failed to update meeting minutes" });
    }
  });

  app.delete("/api/meeting-minutes/:id", requireProjectAccess, async (req, res) => {
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
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      if (user) {
        try {
          const userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.email || 'Unknown';
          const momDelProject = minutes.projectId ? await storage.getProject(minutes.projectId) : null;
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'meeting_minutes_delete',
            fileName: minutes.fileName,
            filePath: minutes.filePath,
            projectId: minutes.projectId || null,
            description: `deleted meeting minutes: ${minutes.meetingTitle} (${minutes.meetingType})`,
            metadata: {
              momId: minutes.id,
              meetingDate: minutes.meetingDate,
              meetingType: minutes.meetingType,
              projectId: minutes.projectId,
              projectName: momDelProject?.projectName ?? null,
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

  // ===== Meeting Action Items Routes =====
  
  // Get action items for a meeting
  app.get("/api/meeting-minutes/:id/action-items", requireProjectAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const actionItems = await storage.getMeetingActionItems(id);
      res.json(actionItems);
    } catch (error) {
      console.error('Error fetching action items:', error);
      res.status(500).json({ error: "Failed to fetch action items" });
    }
  });

  // Add action items to a meeting
  app.post("/api/meeting-minutes/:id/action-items", requireProjectAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { actionItems } = req.body;
      
      // Verify meeting exists
      const meeting = await storage.getMeetingMinutes(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting minutes not found" });
      }
      
      // Delete existing action items and insert new ones
      await storage.deleteMeetingActionItems(id);
      
      const createdItems = [];
      for (const item of actionItems) {
        const created = await storage.createMeetingActionItem({
          meetingMinutesId: id,
          serialNo: item.serialNo,
          issueDiscussed: item.issueDiscussed,
          responsibility: item.responsibility || null,
          deadline: item.deadline || null,
          remarks: item.remarks || null,
        });
        createdItems.push(created);
      }
      
      res.json(createdItems);
    } catch (error) {
      console.error('Error creating action items:', error);
      res.status(500).json({ error: "Failed to create action items" });
    }
  });

  // Parse Fireflies transcript using Gemini AI
  app.post("/api/parse-fireflies", requireProjectAccess, async (req, res) => {
    try {
      const { transcript, meetingDate, projectName } = req.body;
      
      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const prompt = `You are a professional meeting minutes parser. Analyze the following Fireflies.ai meeting transcript and extract structured action items.

Meeting Context:
- Date: ${meetingDate || 'Not specified'}
- Project: ${projectName || 'Not specified'}

Transcript:
${transcript}

Please extract:
1. List of attendees (names of people who spoke)
2. A concise summary of the meeting (2-3 sentences)
3. Action items with the following structure:
   - Issue/Discussion point
   - Person responsible (if mentioned)
   - Deadline (if mentioned, in YYYY-MM-DD format)
   - Any remarks or additional notes

Return your response in the following JSON format only (no markdown, no code blocks):
{
  "attendees": ["Name 1", "Name 2"],
  "summary": "Brief meeting summary",
  "actionItems": [
    {
      "serialNo": 1,
      "issueDiscussed": "Description of the action item or discussion point",
      "responsibility": "Person name or null",
      "deadline": "YYYY-MM-DD or null",
      "remarks": "Additional notes or null"
    }
  ]
}`;

      // Use the Gemini AI integration
      const { GoogleGenAI } = await import("@google/genai");
      const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
      
      if (!baseUrl || !apiKey) {
        console.error("Gemini AI not configured");
        return res.status(500).json({ error: "AI integration not configured" });
      }
      
      const client = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          apiVersion: "",
          baseUrl: baseUrl,
        },
      });
      
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      });
      
      const content = response.text;
      
      if (!content) {
        return res.status(500).json({ error: "No response from AI" });
      }

      // Parse the JSON response
      try {
        // Clean up the response - remove any markdown code blocks if present
        let cleanContent = content.trim();
        // Remove markdown code blocks
        cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        
        const parsed = JSON.parse(cleanContent.trim());
        res.json(parsed);
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError, content.substring(0, 500));
        res.status(500).json({ error: "Failed to parse AI response" });
      }
    } catch (error) {
      console.error('Error parsing Fireflies transcript:', error);
      res.status(500).json({ error: "Failed to parse transcript" });
    }
  });

  // ===== Works Order Templates Routes =====
  
  // Get all templates (role-based access)
  app.get("/api/works-order-templates", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;

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
      ,
          (req.user as any).orgId
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
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
      console.error('Error importing template:', error);
      res.status(500).json({ error: "Failed to import template" });
    }
  });

  // Create template (admin/designer only)
  app.post("/api/works-order-templates", requireAdmin, async (req, res) => {
    try {
      const validated = insertWorksOrderTemplateSchema.parse(req.body);
      const userId = (req.user as any).id;
      
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
      
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
      const userId = (req.user as any).id;
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
  app.get("/api/works-orders/export", requireProjectAccess, async (req, res) => {
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
      const userId = (req.user as any).id;
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
  app.post("/api/works-orders", requireProjectAccess, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
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
          const woCreatePV = await storage.getProjectVendor(order.projectVendorId);
          const woCreateProject = woCreatePV?.projectId ? await storage.getProject(woCreatePV.projectId) : null;
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_create',
            fileName: `${orderNumber}.pdf`,
            filePath: '',
            projectId: woCreateProject?.id || null,
            description: `created works order ${orderNumber}`,
            metadata: {
              worksOrderId: order.id,
              orderNumber: order.orderNumber,
              projectVendorId: order.projectVendorId,
              projectName: woCreateProject?.projectName ?? null,
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
  app.put("/api/works-orders/:id", requireProjectAccess, async (req, res) => {
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
  app.post("/api/works-orders/:id/send", requireProjectAccess, async (req, res) => {
    try {
      const userId = (req.user as any).id;
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
          const woSendPV = await storage.getProjectVendor(order.projectVendorId);
          const woSendProject = woSendPV?.projectId ? await storage.getProject(woSendPV.projectId) : null;
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_send',
            fileName: `${order.orderNumber}.pdf`,
            filePath: '',
            projectId: woSendProject?.id || null,
            description: `sent works order ${order.orderNumber} to client`,
            metadata: {
              worksOrderId: order.id,
              orderNumber: order.orderNumber,
              projectVendorId: order.projectVendorId,
              projectName: woSendProject?.projectName ?? null,
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
  app.post("/api/works-orders/:id/void", requireProjectAccess, async (req, res) => {
    try {
      const userId = (req.user as any).id;
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
          const woVoidPV = await storage.getProjectVendor(order.projectVendorId);
          const woVoidProject = woVoidPV?.projectId ? await storage.getProject(woVoidPV.projectId) : null;
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_void',
            fileName: `${order.orderNumber}.pdf`,
            filePath: '',
            projectId: woVoidProject?.id || null,
            description: `voided works order ${order.orderNumber}${reason ? `: ${reason}` : ''}`,
            metadata: {
              worksOrderId: order.id,
              orderNumber: order.orderNumber,
              projectVendorId: order.projectVendorId,
              voidReason: reason,
              projectName: woVoidProject?.projectName ?? null,
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
  app.delete("/api/works-orders/:id", requireProjectAccess, async (req, res) => {
    try {
      const userId = (req.user as any).id;
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
          const woDelPV = await storage.getProjectVendor(order.projectVendorId);
          const woDelProject = woDelPV?.projectId ? await storage.getProject(woDelPV.projectId) : null;
          await storage.createActivity({
            userId: user.id,
            userName: userName,
            userEmail: user.email || '',
            activityType: 'works_order_delete',
            fileName: `${order.orderNumber}.pdf`,
            filePath: '',
            projectId: woDelProject?.id || null,
            description: `deleted works order ${order.orderNumber}`,
            metadata: {
              worksOrderId: order.id,
              orderNumber: order.orderNumber,
              projectVendorId: order.projectVendorId,
              projectName: woDelProject?.projectName ?? null,
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
        const woSignPV = await storage.getProjectVendor(order.projectVendorId);
        const woSignProject = woSignPV?.projectId ? await storage.getProject(woSignPV.projectId) : null;
        await storage.createActivity({
          userId: '', // No user for public signatures
          userName: validated.signerName,
          userEmail: validated.signerEmail,
          activityType: 'works_order_sign',
          fileName: `${order.orderNumber}.pdf`,
          filePath: '',
          projectId: woSignProject?.id || null,
          description: `signed works order ${order.orderNumber}`,
          metadata: {
            worksOrderId: order.id,
            orderNumber: order.orderNumber,
            signatureId: signature.id,
            signerName: validated.signerName,
            signerEmail: validated.signerEmail,
            projectName: woSignProject?.projectName ?? null,
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
  app.post("/api/works-orders/import", requireProjectAccess, multer().array('files'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const { projectId, categoryId, categoryName, vendorId } = req.body;

      if (!projectId || !categoryId || !categoryName || !vendorId) {
        return res.status(400).json({ error: "Project, category, and vendor are required" });
      }

      const userId = (req.user as any).id;

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

      // Create works order for an already-issued document (file already exists)
      const firstFile = files[0];
      const sanitizedFileName = firstFile.originalname.replace(/\.[^/.]+$/, "");
      const worksOrder = await storage.createWorksOrder({
        serialCounter: Number(serial),
        orderNumber,
        title: `${sanitizedFileName} - ${categoryName}`,
        status: 'sent',
        templateId: null,
        projectVendorId,
        scope: `Imported works order with ${files.length} file(s)`,
        totalValue: null,
        startDate: null,
        completionDate: null,
        paymentTerms: null,
        createdBy: userId,
      });

      // Upload all files in parallel for better performance
      const uploadPromises = files.map(async (file) => {
        const objectPath = await uploadToObjectStorage(
          file.buffer,
          file.originalname,
          userId,
          file.mimetype
        ,
          (req.user as any).orgId
        );
        return { file, objectPath };
      });
      
      const uploadResults = await Promise.all(uploadPromises);
      
      // Create file records after all uploads complete
      const uploadedFiles = [];
      for (const { file, objectPath } of uploadResults) {
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
        const woImportProject = await storage.getProject(projectId);
        await storage.createActivity({
          userId,
          userName: (req.user as any).claims.name || 'Unknown',
          userEmail: (req.user as any).claims.email || '',
          activityType: 'works_order_create',
          fileName: `${files.length} file(s)`,
          filePath: uploadedFiles[0]?.path || '',
          projectId: projectId || null,
          description: `created works order ${worksOrder.orderNumber} with ${files.length} file(s)`,
          metadata: {
            worksOrderId: worksOrder.id,
            orderNumber: worksOrder.orderNumber,
            categoryId,
            categoryName,
            projectId,
            imported: true,
            fileCount: files.length,
            projectName: woImportProject?.projectName ?? null,
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
    } catch (error: any) {
      if (handleLimitError(res, error)) return;
      console.error('Error importing works order:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to import works order";
      res.status(500).json({ error: errorMessage });
    }
  });

  // ─── Design Intelligence Chat ─────────────────────────────────────────────
  app.post("/api/ai-assistant/chat", requireAdmin, async (req, res) => {
    try {
      const { messages } = req.body as { messages: DesignChatMessage[] };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const reply = await chatWithDesignAssistant(messages);
      res.json({ reply });
    } catch (error) {
      console.error("Design assistant error:", error);
      const msg = error instanceof Error ? error.message : "AI assistant failed";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/ai-assistant/elevation", requireAdmin, async (req, res) => {
    try {
      const { messages } = req.body as { messages: DesignChatMessage[] };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const svg = await generateElevationSVG(messages);
      res.json({ svg });
    } catch (error) {
      console.error("Elevation error:", error);
      const msg = error instanceof Error ? error.message : "Failed to generate elevation";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/ai-assistant/floor-plan", requireAdmin, async (req, res) => {
    try {
      const { messages } = req.body as { messages: DesignChatMessage[] };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const svg = await generateFloorPlanSVG(messages);
      res.json({ svg });
    } catch (error) {
      console.error("Floor plan error:", error);
      const msg = error instanceof Error ? error.message : "Failed to generate floor plan";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/ai-assistant/render-brief", requireAdmin, async (req, res) => {
    try {
      const { messages } = req.body as { messages: DesignChatMessage[] };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const brief = await generateRenderBrief(messages);
      res.json(brief);
    } catch (error) {
      console.error("Render brief error:", error);
      const msg = error instanceof Error ? error.message : "Failed to generate render brief";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/ai-assistant/floor-plan-dxf", requireAdmin, async (req, res) => {
    try {
      const { messages } = req.body as { messages: DesignChatMessage[] };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const spec = await generateFloorPlanDXFSpec(messages);
      const dxf = generateDXF(spec);
      res.setHeader("Content-Type", "application/dxf");
      res.setHeader("Content-Disposition", `attachment; filename="${spec.title.replace(/[^a-z0-9_-]/gi, "_")}_FloorPlan.dxf"`);
      res.send(dxf);
    } catch (error) {
      console.error("Floor plan DXF error:", error);
      const msg = error instanceof Error ? error.message : "Failed to generate floor plan DXF";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/ai-assistant/elevation-dxf", requireAdmin, async (req, res) => {
    try {
      const { messages } = req.body as { messages: DesignChatMessage[] };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const spec = await generateElevationDXFSpec(messages);
      const dxf = generateDXF(spec);
      res.setHeader("Content-Type", "application/dxf");
      res.setHeader("Content-Disposition", `attachment; filename="${spec.title.replace(/[^a-z0-9_-]/gi, "_")}_Elevation.dxf"`);
      res.send(dxf);
    } catch (error) {
      console.error("Elevation DXF error:", error);
      const msg = error instanceof Error ? error.message : "Failed to generate elevation DXF";
      res.status(500).json({ error: msg });
    }
  });

  // ---- AI DESIGN REVIEW ----
  app.post("/api/ai-review", requireAuth, async (req, res) => {
    try {
      const { filePath, fileName, reviewType } = req.body as {
        filePath: string;
        fileName: string;
        reviewType: string;
      };

      if (!filePath || !fileName || !reviewType) {
        return res.status(400).json({ error: "filePath, fileName and reviewType are required" });
      }

      // Fetch file buffer from object storage
      const buffer = await downloadObjectBuffer(filePath);
      if (!buffer) {
        return res.status(404).json({ error: "File not found in storage" });
      }

      // Cap at 10 MB — Anthropic base64 limit is ~5 MB for images, 32 MB for PDFs
      const MAX_BYTES = 10 * 1024 * 1024;
      if (buffer.length > MAX_BYTES) {
        return res.status(413).json({
          error: `File is too large for AI review (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`,
        });
      }

      // Derive MIME type from extension
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      const MIME_MAP: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        pdf: "application/pdf",
        dxf: "text/plain",
        dwg: "text/plain",
        obj: "text/plain",
      };
      const mimeType = MIME_MAP[ext] ?? "image/jpeg";

      const base64Data = buffer.toString("base64");
      const result = await reviewDesignFile(base64Data, mimeType, fileName, reviewType);
      res.json(result);
    } catch (err: any) {
      console.error("[ai-review] Error:", err);
      res.status(500).json({ error: err.message ?? "Review failed" });
    }
  });

  // ---- CLIENT PORTAL ENDPOINTS ----
  // Returns all projects the logged-in user has access to
  app.get("/api/client-portal/projects", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      const userProjects = await storage.getProjectsForUser(userId, role);
      res.json(userProjects);
    } catch (error) {
      console.error('Error fetching client portal projects:', error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Returns full portal data for a single project (with access verification)
  app.get("/api/client-portal/:projectId/summary", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const userRole = await storage.getUserRole(userId);
      const role = userRole?.role || 'client';
      const { projectId } = req.params;

      const accessibleProjects = await storage.getProjectsForUser(userId, role);
      const project = accessibleProjects.find(p => p.id === projectId);
      if (!project) {
        return res.status(403).json({ error: "Access denied to this project" });
      }

      const [renders, moodboardItems, workingDrawings, specs, minutes, tasks] = await Promise.all([
        storage.getMoodboardsByProject(projectId, 'render'),
        storage.getMoodboardsByProject(projectId, 'moodboard'),
        storage.getMoodboardsByProject(projectId, 'working_drawing'),
        storage.getAllSpecifications(),
        storage.getMeetingMinutesByProject(projectId),
        storage.getTasksByProject(projectId),
      ]);

      res.json({
        project,
        renders,
        moodboards: moodboardItems,
        workingDrawings,
        specifications: specs,
        meetingMinutes: minutes,
        tasks,
      });
    } catch (error) {
      console.error('Error fetching client portal summary:', error);
      res.status(500).json({ error: "Failed to fetch portal data" });
    }
  });

  // =============================================
  // BILLING ROUTES (Stripe)
  // =============================================
  // Note: POST /api/billing/webhook is registered in server/index.ts
  // BEFORE express.json() so it receives the raw body required for
  // Stripe signature verification. All other billing endpoints live here.

  // Stripe checkout/portal disabled until billing is configured. See docs/migrations.md for re-enabling.
  /*
  // Map plan slugs to Stripe price IDs (set via environment variables)
  const PLAN_PRICE_IDS: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };

  function getBillingBaseUrl(req: any): string {
    const domains = process.env.REPLIT_DOMAINS;
    return process.env.APP_URL ||
      (domains ? `https://${domains.split(',')[0].trim()}` : `${req.protocol}://${req.hostname}`);
  }
  */

  // GET /api/billing/status — current org plan info (admin, designer, project_manager)
  app.get('/api/billing/status', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const userRole = await storage.getUserRole(user.id);
      if (!(BILLING_VISIBLE_ROLES as readonly string[]).includes(userRole?.role || '')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      if (!user.orgId) return res.status(400).json({ error: 'No organisation linked to this account' });
      const org = await storage.getOrganisation(user.orgId);
      if (!org) return res.status(404).json({ error: 'Organisation not found' });
      res.json({
        plan: org.plan,
        planStatus: org.planStatus,
        currentPeriodEnd: org.currentPeriodEnd,
        hasStripeCustomer: !!org.stripeCustomerId,
      });
    } catch (error) {
      console.error('Error fetching billing status:', error);
      res.status(500).json({ error: 'Failed to fetch billing status' });
    }
  });

  // Stripe webhook disabled until billing is configured. See docs/migrations.md for re-enabling.
  /*
  // POST /api/billing/checkout — create a Stripe Checkout session (admin-only, no designers)
  app.post('/api/billing/checkout', requireAdminOnly, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user.orgId) return res.status(400).json({ error: 'No organisation linked to this account' });
      const org = await storage.getOrganisation(user.orgId);
      if (!org) return res.status(404).json({ error: 'Organisation not found' });

      const { plan } = req.body;
      if (!plan || !PLAN_PRICE_IDS[plan]) {
        return res.status(400).json({
          error: `Invalid plan. Valid options: ${Object.keys(PLAN_PRICE_IDS).join(', ')}`,
        });
      }

      const priceId = PLAN_PRICE_IDS[plan];
      if (!priceId) {
        return res.status(400).json({ error: `Price ID for plan "${plan}" is not configured (set STRIPE_PRICE_${plan.toUpperCase()})` });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const baseUrl = getBillingBaseUrl(req);
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: org.stripeCustomerId || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { orgId: org.id, plan },
        success_url: `${baseUrl}/settings?billing=success`,
        cancel_url: `${baseUrl}/settings?billing=cancelled`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create checkout session' });
    }
  });
  */

  // GET /api/billing/usage — current org plan limits and usage (admin + designer)
  app.get('/api/billing/usage', requireAdmin, async (req, res) => {
    try {
      const user = req.user as { id: string; orgId?: string | null };
      if (!user.orgId) return res.status(400).json({ error: 'No organisation linked to this account' });
      const org = await storage.getOrganisation(user.orgId);
      const plan = org?.plan || 'trial';
      const limits = getPlanLimits(plan);
      const usage = await storage.getOrgUsage(user.orgId);
      res.json({ plan, limits, usage });
    } catch (error) {
      console.error('Error fetching billing usage:', error);
      res.status(500).json({ error: 'Failed to fetch billing usage' });
    }
  });

  // Stripe webhook disabled until billing is configured. See docs/migrations.md for re-enabling.
  /*
  // POST /api/billing/portal — create a Stripe Customer Portal session (admin-only, no designers)
  app.post('/api/billing/portal', requireAdminOnly, async (req, res) => {
    try {
      const user = req.user as { id: string; orgId?: string | null };
      if (!user.orgId) return res.status(400).json({ error: 'No organisation linked to this account' });
      const org = await storage.getOrganisation(user.orgId);
      if (!org) return res.status(404).json({ error: 'Organisation not found' });
      if (!org.stripeCustomerId) {
        return res.status(400).json({ error: 'No Stripe customer associated with this account. Subscribe first.' });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${getBillingBaseUrl(req)}/settings`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating portal session:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create portal session' });
    }
  });
  */

  // GET /api/billing/trial-banner-snooze — fetch the server-side snooze preference for the current user
  app.get('/api/billing/trial-banner-snooze', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { snoozedUntil, snoozeDuration } = await storage.getTrialBannerSnooze(user.id);
      res.json({
        snoozedUntil: snoozedUntil ? snoozedUntil.getTime() : null,
        snoozeDuration: snoozeDuration ?? null,
      });
    } catch (error) {
      console.error('Error fetching trial banner snooze:', error);
      res.status(500).json({ error: 'Failed to fetch trial banner snooze' });
    }
  });

  // POST /api/billing/trial-banner-snooze — persist the snooze preference server-side
  app.post('/api/billing/trial-banner-snooze', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { snoozedUntil, snoozeDuration } = req.body;
      if (typeof snoozedUntil !== 'number' || !Number.isFinite(snoozedUntil)) {
        return res.status(400).json({ error: 'snoozedUntil must be a finite number (epoch ms)' });
      }
      const validDurations = ['1', '3', 'forever'];
      const duration = typeof snoozeDuration === 'string' && validDurations.includes(snoozeDuration)
        ? snoozeDuration
        : null;
      const snoozedUntilDate = new Date(snoozedUntil);
      await storage.updateTrialBannerSnooze(user.id, snoozedUntilDate, duration);
      res.json({ ok: true, snoozedUntil: snoozedUntilDate.getTime(), snoozeDuration: duration });
    } catch (error) {
      console.error('Error saving trial banner snooze:', error);
      res.status(500).json({ error: 'Failed to save trial banner snooze' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Super-admin back-office routes — all gated by requireSuperAdmin
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/superadmin/organisations — list all orgs with aggregated stats
  app.get("/api/superadmin/organisations", requireSuperAdmin, async (req, res) => {
    try {
      const orgs = await storage.getAllOrganisationsWithStats();
      res.json(orgs);
    } catch (error) {
      console.error("Superadmin orgs error:", error);
      res.status(500).json({ error: "Failed to fetch organisations" });
    }
  });

  // GET /api/superadmin/organisations/:orgId — full detail for one org
  app.get("/api/superadmin/organisations/:orgId", requireSuperAdmin, async (req, res) => {
    try {
      const { orgId } = req.params;
      const [org, orgUsers, orgProjects, recentActivity, usage] = await Promise.all([
        storage.getOrganisation(orgId),
        storage.getUsersByOrg(orgId),
        storage.getAllProjects().then(ps => ps.filter(p => p.orgId === orgId)),
        storage.getRecentActivitiesByOrg(orgId, 20),
        storage.getOrgUsage(orgId),
      ]);
      if (!org) return res.status(404).json({ error: "Organisation not found" });

      // Fetch roles for users — select only safe fields explicitly to avoid any cast
      const usersWithRoles = await Promise.all(
        orgUsers.map(async u => {
          const role = await storage.getUserRole(u.id);
          return {
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            profileImageUrl: u.profileImageUrl,
            createdAt: u.createdAt,
            role: role?.role || "client",
            isSuperAdmin: !!u.isSuperAdmin,
          };
        })
      );

      // Filter activity to org members
      const orgUserIds = new Set(orgUsers.map(u => u.id));
      const orgActivity = recentActivity.filter(a => orgUserIds.has(a.userId));

      // Pull subscription history from Stripe when a customer ID is available.
      // Gracefully fall back to an empty array if Stripe is not configured.
      type SubscriptionEvent = { date: string; description: string; amount: number | null };
      let subscriptionHistory: SubscriptionEvent[] = [];
      if (org.stripeCustomerId) {
        try {
          const { getUncachableStripeClient } = await import('./stripeClient');
          const stripe = await getUncachableStripeClient();
          const invoices = await stripe.invoices.list({
            customer: org.stripeCustomerId,
            limit: 10,
          });
          subscriptionHistory = invoices.data.map(inv => ({
            date: new Date(inv.created * 1000).toISOString(),
            description: inv.description || inv.lines.data[0]?.description || "Invoice",
            amount: inv.amount_paid != null ? inv.amount_paid / 100 : null,
          }));
        } catch {
          // Stripe not configured or request failed — subscription history stays empty
        }
      }

      res.json({ org, users: usersWithRoles, projects: orgProjects, recentActivity: orgActivity, usage, subscriptionHistory });
    } catch (error) {
      console.error("Superadmin org detail error:", error);
      res.status(500).json({ error: "Failed to fetch organisation detail" });
    }
  });

  // PATCH /api/superadmin/organisations/:orgId/plan — override plan directly
  app.patch("/api/superadmin/organisations/:orgId/plan", requireSuperAdmin, async (req, res) => {
    try {
      const { orgId } = req.params;
      const { plan } = req.body;
      const validPlans = ["trial", "starter", "pro", "enterprise"];
      if (!plan || !validPlans.includes(plan)) {
        return res.status(400).json({ error: `plan must be one of: ${validPlans.join(", ")}` });
      }

      const org = await storage.getOrganisation(orgId);
      if (!org) return res.status(404).json({ error: "Organisation not found" });

      const previousPlan = org.plan;
      const updated = await storage.updateOrganisation(orgId, { plan, planStatus: "active" });

      await storage.writeSuperAdminAuditLog({
        superAdminId: (req.user as any).id,
        action: "plan_override",
        targetOrgId: orgId,
        targetUserId: null,
        metadata: { previousPlan, newPlan: plan },
      });

      // Notify org admins about the plan change (continue on per-recipient errors)
      {
        const orgUsers = await storage.getUsersByOrg(orgId);
        const { sendPlanChangedEmail } = await import("./email");
        const notifiedEmails: string[] = [];
        const failedEmails: string[] = [];
        for (const u of orgUsers) {
          if (!u.email) continue;
          const userRole = await storage.getUserRole(u.id);
          if (userRole?.role !== "admin") continue;
          try {
            const prefs = await storage.getNotificationPreferences(u.id);
            if (!prefs.planChanges) {
              console.info(`[PLAN_CHANGE] Email suppressed for ${u.email} (planChanges opted out)`);
              continue;
            }
            const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(u.id).catch(() => undefined);
            await sendPlanChangedEmail(u.email, org.name, previousPlan, plan, { unsubscribeToken });
            notifiedEmails.push(u.email);
          } catch (emailErr) {
            console.error(`[PLAN_CHANGE] Failed to notify ${u.email}:`, emailErr);
            failedEmails.push(u.email);
          }
        }
        // Always write audit log if at least one send was attempted
        if (notifiedEmails.length > 0 || failedEmails.length > 0) {
          try {
            await storage.writeSuperAdminAuditLog({
              superAdminId: (req.user as { id: string }).id,
              action: "plan_change_email_sent",
              targetOrgId: orgId,
              targetUserId: null,
              metadata: { notifiedEmails, failedEmails, previousPlan, newPlan: plan },
            });
          } catch (auditErr) {
            console.error("[PLAN_CHANGE] Failed to write email audit log:", auditErr);
          }
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Superadmin plan override error:", error);
      res.status(500).json({ error: "Failed to update plan" });
    }
  });

  // POST /api/superadmin/organisations/:orgId/notify-trial-expiry
  // Manually trigger a trial-expiry warning email to all admins of an org.
  app.post("/api/superadmin/organisations/:orgId/notify-trial-expiry", requireSuperAdmin, async (req, res) => {
    try {
      const { orgId } = req.params;
      const rawDays = req.body.daysRemaining ?? 3;
      const daysRemaining = Math.round(Number(rawDays));
      if (!Number.isFinite(daysRemaining) || daysRemaining < 0 || daysRemaining > 365) {
        return res.status(400).json({ error: "daysRemaining must be an integer between 0 and 365" });
      }

      const org = await storage.getOrganisation(orgId);
      if (!org) return res.status(404).json({ error: "Organisation not found" });

      const orgUsers = await storage.getUsersByOrg(orgId);
      const { sendTrialExpiryEmail } = await import("./email");
      const notifiedEmails: string[] = [];
      const failedEmails: string[] = [];

      for (const u of orgUsers) {
        if (!u.email) continue;
        const userRole = await storage.getUserRole(u.id);
        if (userRole?.role !== "admin") continue;
        try {
          const prefs = await storage.getNotificationPreferences(u.id);
          if (!prefs.trialExpiry) {
            console.info(`[TRIAL_EXPIRY] Email suppressed for ${u.email} (trialExpiry opted out)`);
            continue;
          }
          const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(u.id).catch(() => undefined);
          await sendTrialExpiryEmail(u.email, org.name, Number(daysRemaining), { unsubscribeToken });
          notifiedEmails.push(u.email);
        } catch (emailErr) {
          console.error(`[TRIAL_EXPIRY] Failed to notify ${u.email}:`, emailErr);
          failedEmails.push(u.email);
        }
      }

      if (notifiedEmails.length > 0 || failedEmails.length > 0) {
        try {
          await storage.writeSuperAdminAuditLog({
            superAdminId: (req.user as { id: string }).id,
            action: "trial_expiry_email_sent",
            targetOrgId: orgId,
            targetUserId: null,
            metadata: { notifiedEmails, failedEmails, daysRemaining },
          });
        } catch (auditErr) {
          console.error("[TRIAL_EXPIRY] Failed to write audit log:", auditErr);
        }
      }

      res.json({ notifiedEmails, failedEmails });
    } catch (error) {
      console.error("Superadmin trial expiry notify error:", error);
      res.status(500).json({ error: "Failed to send trial expiry notifications" });
    }
  });

  // Short-lived impersonation token store.
  // Tokens are one-time-use, expire after 60 seconds, and are redeemed via the
  // GET /api/superadmin/impersonate/redeem endpoint which opens in a new browser tab.
  // Using an in-memory store is safe here: tokens are valid for only 60 s and the
  // server is single-process (Replit container). A DB store can replace this if
  // the deployment becomes multi-instance.
  const impersonationTokens = new Map<string, {
    superAdminId: string;
    targetUserId: string;
    targetEmail: string | null;
    expiresAt: number;
  }>();

  // POST /api/superadmin/impersonate/:userId — create a short-lived impersonation token.
  // Returns a { token, redeemUrl } pair. The frontend opens redeemUrl in a new tab;
  // that page redeems the token and activates the impersonation session.
  app.post("/api/superadmin/impersonate/:userId", requireSuperAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const superAdminId = req.session.originalUserId ?? (req.user as { id: string }).id;

      if (userId === superAdminId) {
        console.warn(
          `[superadmin] Self-impersonation attempt blocked for superAdminId=${superAdminId} at ${new Date().toISOString()}`
        );
        try {
          await storage.writeSuperAdminAuditLog({
            superAdminId,
            action: "impersonate_self_blocked",
            targetOrgId: null,
            targetUserId: userId,
            metadata: {},
          });
        } catch (auditErr) {
          console.error("[superadmin] Failed to write impersonate_self_blocked audit log:", auditErr);
        }
        return res.status(400).json({ error: "You cannot impersonate yourself" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      // Record audit entry before issuing the token
      await storage.writeSuperAdminAuditLog({
        superAdminId,
        action: "impersonate",
        targetOrgId: targetUser.orgId ?? null,
        targetUserId: userId,
        metadata: { targetEmail: targetUser.email },
      });

      // Mint a one-time token valid for 60 seconds
      const { randomUUID } = await import("crypto");
      const token = randomUUID();
      impersonationTokens.set(token, {
        superAdminId,
        targetUserId: userId,
        targetEmail: targetUser.email,
        expiresAt: Date.now() + 60_000,
      });

      // Clean up expired tokens opportunistically
      for (const [t, v] of impersonationTokens) {
        if (v.expiresAt < Date.now()) impersonationTokens.delete(t);
      }

      const redeemUrl = `/api/superadmin/impersonate/redeem?token=${token}`;
      res.json({ success: true, token, redeemUrl, targetUserId: userId, targetEmail: targetUser.email });
    } catch (error) {
      console.error("Superadmin impersonate error:", error);
      res.status(500).json({ error: "Failed to start impersonation" });
    }
  });

  // GET /api/superadmin/impersonate/redeem?token=... — redeem a one-time impersonation token.
  // Called by opening the redeemUrl in a new tab. Sets session flags and redirects to /.
  // The super-admin's browser tab that opened this link will now be operating as the
  // impersonated user, with the banner and exit control visible via the effective-user middleware.
  app.get("/api/superadmin/impersonate/redeem", async (req, res) => {
    try {
      const token = req.query.token as string | undefined;
      if (!token) return res.status(400).send("Missing token");

      const entry = impersonationTokens.get(token);
      if (!entry || entry.expiresAt < Date.now()) {
        impersonationTokens.delete(token as string);
        return res.status(400).send("Impersonation token is invalid or has expired. Please generate a new one from the super-admin console.");
      }

      // Consume the token (one-time use)
      impersonationTokens.delete(token);

      // The redeem request comes from a new tab that may not be authenticated as
      // the super-admin (cookie is shared for same-origin). Verify the cookie session
      // belongs to the same super-admin who minted the token.
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).send("You must be logged in as a super-admin to redeem this token.");
      }
      const realUserId = (req.user as { id: string }).id;
      if (realUserId !== entry.superAdminId) {
        return res.status(403).send("Token was issued for a different super-admin session.");
      }

      // Set impersonation on this tab's session and redirect to the app root
      req.session.impersonatingUserId = entry.targetUserId;
      req.session.originalUserId = entry.superAdminId;
      req.session.save(() => {
        res.redirect("/");
      });
    } catch (error) {
      console.error("Superadmin impersonate redeem error:", error);
      res.status(500).send("Failed to redeem impersonation token.");
    }
  });

  // POST /api/superadmin/impersonate/exit — end impersonation, return to super-admin session
  // Uses requireSuperAdmin (not requireAuth) because the underlying session still belongs to
  // the super-admin; the impersonation only affects the /api/auth/user presentation layer.
  app.post("/api/superadmin/impersonate/exit", requireSuperAdmin, async (req, res) => {
    try {
      if (!req.session.impersonatingUserId) {
        return res.status(400).json({ error: "Not currently impersonating anyone" });
      }
      delete req.session.impersonatingUserId;
      delete req.session.originalUserId;
      res.json({ success: true });
    } catch (error) {
      console.error("Superadmin impersonate exit error:", error);
      res.status(500).json({ error: "Failed to exit impersonation" });
    }
  });

  // GET /api/superadmin/metrics — aggregate metrics across all orgs
  app.get("/api/superadmin/metrics", requireSuperAdmin, async (req, res) => {
    try {
      const orgs = await storage.getAllOrganisationsWithStats();
      const totalOrgs = orgs.length;
      const trialOrgs = orgs.filter(o => o.plan === "trial").length;
      const pastDueOrgs = orgs.filter(o => o.planStatus === "past_due").length;
      const activeOrgs = orgs.filter(o => o.planStatus === "active").length;

      // Try to pull live MRR from Stripe active subscriptions. If Stripe is not
      // configured or the call fails, fall back to a plan-price estimate.
      let mrrEstimate = 0;
      let mrrSource: "stripe" | "estimate" = "estimate";
      try {
        const { getUncachableStripeClient } = await import('./stripeClient');
        const stripe = await getUncachableStripeClient();
        // Fetch up to 100 active subscriptions with price data expanded
        const subs = await stripe.subscriptions.list({
          status: "active",
          limit: 100,
          expand: ["data.items.data.price"],
        });
        mrrEstimate = subs.data.reduce((sum, sub) => {
          const subAmount = sub.items.data.reduce((itemSum, item) => {
            const price = item.price;
            const qty = item.quantity ?? 1;
            const unitAmount = price.unit_amount ?? 0;
            if (price.recurring?.interval === "month") return itemSum + qty * unitAmount / 100;
            if (price.recurring?.interval === "year") return itemSum + qty * unitAmount / 100 / 12;
            return itemSum;
          }, 0);
          return sum + subAmount;
        }, 0);
        mrrSource = "stripe";
      } catch {
        // Stripe not configured or unavailable — derive from plan distribution
        const PLAN_MRR: Record<string, number> = { trial: 0, starter: 49, pro: 149, enterprise: 499 };
        mrrEstimate = orgs.reduce((sum, o) => sum + (PLAN_MRR[o.plan] ?? 0), 0);
      }

      res.json({ totalOrgs, trialOrgs, pastDueOrgs, activeOrgs, mrrEstimate, mrrSource });
    } catch (error) {
      console.error("Superadmin metrics error:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // PATCH /api/superadmin/users/:userId/superadmin — grant or revoke super-admin status
  app.patch("/api/superadmin/users/:userId/superadmin", requireSuperAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { isSuperAdmin: grantSuperAdmin } = req.body;
      if (typeof grantSuperAdmin !== "boolean") {
        return res.status(400).json({ error: "isSuperAdmin must be a boolean" });
      }

      const callerId = (req.user as { id: string }).id;
      if (!grantSuperAdmin && userId === callerId) {
        return res.status(400).json({ error: "You cannot revoke your own super-admin access." });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      await storage.setUserSuperAdmin(userId, grantSuperAdmin);

      await storage.writeSuperAdminAuditLog({
        superAdminId: (req.user as { id: string }).id,
        action: grantSuperAdmin ? "grant_super_admin" : "revoke_super_admin",
        targetOrgId: targetUser.orgId ?? null,
        targetUserId: userId,
        metadata: { targetEmail: targetUser.email ?? "" },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Superadmin set super-admin error:", error);
      res.status(500).json({ error: "Failed to update super-admin status" });
    }
  });

  // GET /api/superadmin/audit-log — recent audit log entries
  app.get("/api/superadmin/audit-log", requireSuperAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const logs = await storage.getSuperAdminAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Superadmin audit log error:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  const httpServer = createServer(app);

  // ── Scheduled trial-expiry warning job ─────────────────────────────────────
  // Runs once on startup and then every 24 hours.
  // Finds orgs on a trial plan whose trial ends within WARN_WITHIN_DAYS days
  // and that have not been notified within SUPPRESS_WITHIN_DAYS days, then
  // emails all their admins. Both values are configurable via server/config.ts.
  async function runTrialExpiryWarnings(): Promise<void> {
    try {
      const { sendTrialExpiryWarningEmail } = await import("./email");
      const orgs = await storage.getOrgsNearTrialExpiry(WARN_WITHIN_DAYS, SUPPRESS_WITHIN_DAYS);
      if (orgs.length === 0) return;

      console.info(`[TRIAL_EXPIRY_JOB] Found ${orgs.length} org(s) near trial expiry.`);

      for (const org of orgs) {
        // Determine days remaining
        let trialEnd: Date;
        if (org.currentPeriodEnd) {
          trialEnd = new Date(org.currentPeriodEnd);
        } else {
          trialEnd = new Date(org.createdAt.getTime() + TRIAL_DURATION_DAYS * 86_400_000);
        }
        const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000));

        // Find all admin users for this org
        const orgUsers = await storage.getUsersByOrg(org.id);
        const notifiedEmails: string[] = [];
        const failedEmails: string[] = [];
        let adminUserId: string | null = null;

        for (const u of orgUsers) {
          const roleRow = await storage.getUserRole(u.id);
          if (roleRow?.role !== "admin" || !u.email) continue;
          adminUserId = adminUserId ?? u.id;
          try {
            const prefs = await storage.getNotificationPreferences(u.id);
            if (!prefs.trialExpiry) {
              console.info(`[TRIAL_EXPIRY_JOB] Email suppressed for ${u.email} (trialExpiry opted out)`);
              continue;
            }
            const unsubscribeToken = await storage.getOrCreateUnsubscribeToken(u.id).catch(() => undefined);
            await sendTrialExpiryWarningEmail(u.email, org.name, daysRemaining, { unsubscribeToken });
            notifiedEmails.push(u.email);
          } catch (emailErr) {
            console.error(`[TRIAL_EXPIRY_JOB] Failed to email ${u.email} for org ${org.id}:`, emailErr);
            failedEmails.push(u.email);
          }
        }

        const notifiedAt = new Date();

        // Only suppress future notifications if at least one email was delivered successfully
        if (notifiedEmails.length > 0) {
          try {
            await storage.markOrgTrialExpiryNotified(org.id, notifiedAt);
          } catch (markErr) {
            console.error(`[TRIAL_EXPIRY_JOB] Failed to mark org ${org.id} as notified:`, markErr);
          }
        }

        // Audit log — even if no admin email was found
        try {
          await storage.writeSuperAdminAuditLog({
            superAdminId: null,
            action: "trial_expiry_warning_email_sent",
            targetOrgId: org.id,
            targetUserId: adminUserId,
            metadata: {
              notifiedEmails,
              failedEmails,
              daysRemaining,
              trialEndDate: trialEnd.toISOString(),
              triggeredBy: "scheduled_job",
            },
          });
        } catch (auditErr) {
          console.error(`[TRIAL_EXPIRY_JOB] Failed to write audit log for org ${org.id}:`, auditErr);
        }

        console.info(
          `[TRIAL_EXPIRY_JOB] Org "${org.name}" (${org.id}): notified ${notifiedEmails.length} admin(s), ` +
          `${daysRemaining} day(s) remaining.`
        );
      }
    } catch (err) {
      console.error("[TRIAL_EXPIRY_JOB] Unexpected error:", err);
    }
  }

  // ── User profile ─────────────────────────────────────────────────────────────
  // PATCH /api/user/profile
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const schema = z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().max(100).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid profile data", details: parsed.error.flatten() });
      }
      const updatedUser = await storage.updateUserProfile(userId, parsed.data);
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      console.error("Update user profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ── Notification preferences ────────────────────────────────────────────────
  // GET /api/user/notification-preferences
  app.get("/api/user/notification-preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const prefs = await storage.getNotificationPreferences(userId);
      res.json(prefs);
    } catch (error) {
      console.error("Get notification preferences error:", error);
      res.status(500).json({ error: "Failed to get notification preferences" });
    }
  });

  // PATCH /api/user/notification-preferences
  app.patch("/api/user/notification-preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const schema = z.object({
        planChanges: z.boolean().optional(),
        paymentFailures: z.boolean().optional(),
        trialExpiry: z.boolean().optional(),
        invitationAccepted: z.boolean().optional(),
        projectUpdates: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid preferences", details: parsed.error.flatten() });
      }
      const prefs = await storage.updateNotificationPreferences(userId, parsed.data);
      res.json(prefs);
    } catch (error) {
      console.error("Update notification preferences error:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  // GET /api/user/unsubscribe?token=...&type=...
  // One-click unsubscribe endpoint — no login required.
  // Disables a specific notification type for the user identified by the unsubscribe token.
  app.get("/api/user/unsubscribe", async (req, res) => {
    const { token, type } = req.query as { token?: string; type?: string };

    const validTypes: Record<keyof NotificationPreferences, string> = {
      paymentFailures: "payment failure",
      planChanges: "plan change",
      trialExpiry: "trial expiry",
      invitationAccepted: "invitation accepted",
      projectUpdates: "project updates",
    };

    if (!token || typeof token !== "string") {
      return res.status(400).send(buildUnsubscribePage("Invalid or missing unsubscribe token.", false));
    }
    const notifKey = type as keyof NotificationPreferences | undefined;
    if (!notifKey || !(notifKey in validTypes)) {
      return res.status(400).send(buildUnsubscribePage("Invalid notification type.", false));
    }

    try {
      const user = await storage.getUserByUnsubscribeToken(token);
      if (!user) {
        return res.status(404).send(buildUnsubscribePage("Unsubscribe link not found or already used.", false));
      }
      const prefUpdate: Partial<NotificationPreferences> = { [notifKey]: false };
      await storage.updateNotificationPreferences(user.id, prefUpdate);
      const label = validTypes[notifKey];
      console.info(`[UNSUBSCRIBE] User ${user.email} opted out of '${notifKey}' via token`);
      const { getBaseUrl } = await import("./email");
      const settingsUrl = `${getBaseUrl()}/settings`;
      return res.send(buildUnsubscribePage(
        `You've been unsubscribed from <strong>${label}</strong> emails.`,
        true,
        settingsUrl
      ));
    } catch (error) {
      console.error("Unsubscribe error:", error);
      return res.status(500).send(buildUnsubscribePage("Something went wrong. Please try again later.", false));
    }
  });

  function buildUnsubscribePage(message: string, success: boolean, settingsUrl?: string): string {
    const color = success ? "#0071e3" : "#c00";
    const icon = success ? "&#10003;" : "&#33;";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribe — Olympik Design</title>
  <style>
    body { font-family: Inter, sans-serif; background: #f5f5f7; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.06); }
    .icon { width: 56px; height: 56px; border-radius: 50%; background: ${color}; color: #fff; font-size: 28px; line-height: 56px; margin: 0 auto 20px; }
    h1 { font-size: 20px; font-weight: 700; color: #1d1d1f; margin: 0 0 12px; }
    p { color: #3d3d3d; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    a.btn { display: inline-block; background: #0071e3; color: #fff; font-size: 14px; font-weight: 600; padding: 10px 24px; border-radius: 8px; text-decoration: none; }
    .footer { margin-top: 24px; font-size: 12px; color: #6e6e73; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>Olympik Design</h1>
    <p>${message}</p>
    ${settingsUrl ? `<a class="btn" href="${settingsUrl}">Manage all preferences</a>` : ""}
    <div class="footer">You can always update your notification preferences from your account settings.</div>
  </div>
</body>
</html>`;
  }

  // ── Working Drawings ─────────────────────────────────────────────────────────

  // GET /api/working-drawings/rooms?projectId=xxx
  app.get("/api/working-drawings/rooms", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { projectId } = req.query as { projectId?: string };
      if (!orgId || !projectId) return res.status(400).json({ error: "orgId and projectId required" });
      const result = await storage.getRoomsForProject(orgId, projectId);
      res.json(result);
    } catch (err) {
      console.error("GET /api/working-drawings/rooms error:", err);
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  // GET /api/working-drawings?projectId=xxx&search=yyy&drawingType=working|concept
  app.get("/api/working-drawings", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const role = req.user?.role;
      const { projectId, search, drawingType } = req.query as { projectId?: string; search?: string; drawingType?: string };
      if (!orgId || !projectId) return res.status(400).json({ error: "orgId and projectId required" });
      if (drawingType === 'concept' && role === 'project_manager') return res.status(403).json({ error: "Forbidden" });
      const result = await storage.getDrawingsForProject(orgId, projectId, search || undefined, drawingType || 'working');
      res.json(result);
    } catch (err) {
      console.error("GET /api/working-drawings error:", err);
      res.status(500).json({ error: "Failed to fetch drawings" });
    }
  });

  // POST /api/working-drawings/rooms — create room
  app.post("/api/working-drawings/rooms", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { projectId, name, roomType } = req.body as { projectId?: string; name?: string; roomType?: string };
      if (!orgId || !projectId || !name?.trim() || !roomType?.trim()) {
        return res.status(400).json({ error: "projectId, name and roomType are required" });
      }
      const result = await storage.createRoom(orgId, projectId, { name: name.trim(), roomType: roomType.trim() });
      res.status(201).json(result);
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "A room with that name already exists in this project." });
      }
      console.error("POST /api/working-drawings/rooms error:", err);
      res.status(500).json({ error: "Failed to create room" });
    }
  });

  // PATCH /api/working-drawings/rooms/:id — rename / retype room
  app.patch("/api/working-drawings/rooms/:id", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { name, roomType } = req.body as { name?: string; roomType?: string };
      if (!orgId || !name?.trim() || !roomType?.trim()) {
        return res.status(400).json({ error: "name and roomType are required" });
      }
      const result = await storage.updateRoom(id, orgId, { name: name.trim(), roomType: roomType.trim() });
      if (!result) return res.status(404).json({ error: "Room not found" });
      res.json(result);
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "A room with that name already exists in this project." });
      }
      console.error("PATCH /api/working-drawings/rooms/:id error:", err);
      res.status(500).json({ error: "Failed to update room" });
    }
  });

  // DELETE /api/working-drawings/rooms/:id — safe delete (blocked if drawings exist)
  app.delete("/api/working-drawings/rooms/:id", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { projectId } = req.query as { projectId?: string };
      if (!orgId || !projectId) return res.status(400).json({ error: "projectId required" });
      const result = await storage.deleteRoom(id, orgId, projectId);
      if (!result.success) {
        return res.status(409).json({ error: `This room has ${result.drawingCount} drawing${result.drawingCount === 1 ? "" : "s"} — move or remove them first.`, drawingCount: result.drawingCount });
      }
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/working-drawings/rooms/:id error:", err);
      res.status(500).json({ error: "Failed to delete room" });
    }
  });

  // PATCH /api/working-drawings/:drawingId — update mutable fields (category, title)
  app.patch("/api/working-drawings/:drawingId", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { drawingId } = req.params;
      if (!orgId) return res.status(403).json({ error: "Forbidden" });

      const { db: reqDb } = await import("./db");
      const { drawings: drawingsTable } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [drawing] = await reqDb.select().from(drawingsTable)
        .where(and(eq(drawingsTable.id, drawingId), eq(drawingsTable.orgId, orgId)));
      if (!drawing) return res.status(404).json({ error: "Drawing not found" });

      const updates: Record<string, unknown> = {};
      if (typeof req.body.category === "string" && req.body.category.trim()) {
        updates.category = req.body.category.trim();
      }
      if (typeof req.body.title === "string" && req.body.title.trim()) {
        updates.title = req.body.title.trim();
      }
      if ("roomId" in req.body) {
        // Allow null (unassign) or a non-empty string (assign to room)
        updates.roomId = req.body.roomId === null || req.body.roomId === "" ? null : req.body.roomId;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Nothing to update" });
      }

      const [updated] = await reqDb.update(drawingsTable)
        .set(updates)
        .where(and(eq(drawingsTable.id, drawingId), eq(drawingsTable.orgId, orgId)))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("PATCH /api/working-drawings/:drawingId error:", err);
      res.status(500).json({ error: "Failed to update drawing" });
    }
  });

  // DELETE /api/working-drawings/:drawingId — permanently delete a drawing + its files
  app.delete("/api/working-drawings/:drawingId", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { drawingId } = req.params;
      if (!orgId) return res.status(403).json({ error: "Forbidden" });

      const { db: reqDb } = await import("./db");
      const { drawings: drawingsTable, drawingRevisions: dr } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [drawing] = await reqDb.select().from(drawingsTable)
        .where(and(eq(drawingsTable.id, drawingId), eq(drawingsTable.orgId, orgId)));
      if (!drawing) return res.status(404).json({ error: "Drawing not found" });

      const revisions = await reqDb.select({ filePath: dr.filePath })
        .from(dr).where(eq(dr.drawingId, drawingId));

      const objectStorageService = new ObjectStorageService();
      for (const rev of revisions) {
        try {
          const file = await objectStorageService.getObjectEntityFile(rev.filePath);
          await file.delete();
        } catch {
          // Ignore missing / already-deleted files
        }
      }

      await reqDb.delete(drawingsTable).where(eq(drawingsTable.id, drawingId));
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/working-drawings/:drawingId error:", err);
      res.status(500).json({ error: "Failed to delete drawing" });
    }
  });

  // Configure multer for drawing batch uploads (up to 30 files, 100 MB each)
  const drawingBatchUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024, files: 30 },
  });

  // POST /api/working-drawings/upload-batch — upload multiple drawings at once
  app.post("/api/working-drawings/upload-batch", requireAuth, drawingBatchUpload.array("files", 30), async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.id;
      if (!orgId) return res.status(403).json({ error: "Forbidden" });

      const role = req.user?.role;
      const { projectId, roomId, category, state, titles, drawingType } = req.body;
      if (!projectId || !category) {
        return res.status(400).json({ error: "projectId and category are required" });
      }
      if (drawingType === 'concept' && role === 'project_manager') {
        return res.status(403).json({ error: "Forbidden" });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: "No files provided" });

      let titlesArray: string[];
      try {
        titlesArray = titles ? JSON.parse(titles) : files.map((f: Express.Multer.File) => f.originalname.replace(/\.[^/.]+$/, ""));
      } catch {
        titlesArray = files.map((f: Express.Multer.File) => f.originalname.replace(/\.[^/.]+$/, ""));
      }

      const revisionState = ["draft", "for_review", "approved"].includes(state) ? state : "draft";
      const { db: reqDb } = await import("./db");
      const { drawings: drawingsTable, drawingRevisions, revisionEvents } = await import("@shared/schema");

      const results: Array<{ success: boolean; drawingId?: string; title?: string; fileName?: string; error?: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const title = (titlesArray[i] || file.originalname.replace(/\.[^/.]+$/, "")).trim() || file.originalname;
        try {
          const objectPath = await uploadToObjectStorage(file.buffer, file.originalname, userId, file.mimetype, orgId);

          const drawingId = randomUUID();
          await reqDb.insert(drawingsTable).values({
            id: drawingId,
            orgId,
            projectId,
            roomId: roomId && roomId !== "" && roomId !== "__none__" ? roomId : null,
            title,
            category,
            discipline: "Interior",
            drawingType: drawingType === 'concept' ? 'concept' : 'working',
            status: revisionState === "approved" ? "approved" : "planned",
            isTemplatePlaceholder: false,
            createdBy: userId,
          });

          const revisionId = randomUUID();
          await reqDb.insert(drawingRevisions).values({
            id: revisionId,
            orgId,
            drawingId,
            revisionLetter: "A",
            filePath: objectPath,
            fileName: file.originalname,
            fileSize: file.size,
            fileMimeType: file.mimetype,
            state: revisionState,
            uploadedBy: userId,
            uploadedAt: new Date(),
            ...(revisionState === "approved" ? { approvedAt: new Date() } : {}),
          });

          await reqDb.insert(revisionEvents).values({
            id: randomUUID(),
            orgId,
            revisionId,
            eventType: "uploaded",
            actorId: userId,
            createdAt: new Date(),
          });

          results.push({ success: true, drawingId, title });
        } catch (fileErr: any) {
          console.error(`[drawing-batch-upload] failed for ${file.originalname}:`, fileErr);
          results.push({ success: false, fileName: file.originalname, error: fileErr?.message ?? "Upload failed" });
        }
      }

      res.json({ results });
    } catch (err) {
      console.error("POST /api/working-drawings/upload-batch error:", err);
      res.status(500).json({ error: "Failed to process batch upload" });
    }
  });

  // GET /api/working-drawings/:id/view-url — signed download URL for a drawing's file
  app.get("/api/working-drawings/:drawingId/view-url/:revisionId", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { revisionId } = req.params;
      if (!orgId) return res.status(403).json({ error: "Forbidden" });
      const { db: reqDb } = await import("./db");
      const { drawingRevisions: dr } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const rows = await reqDb.select().from(dr).where(and(eq(dr.id, revisionId), eq(dr.orgId, orgId)));
      if (!rows[0]) return res.status(404).json({ error: "Revision not found" });
      const filePath = rows[0].filePath;
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(filePath);
      const signedUrl = await signObjectURL({ bucketName: objectFile.bucket.name, objectName: objectFile.name, method: "GET", ttlSec: 3600 });
      res.json({ url: signedUrl, fileName: rows[0].fileName, fileSize: rows[0].fileSize, mimeType: rows[0].fileMimeType });
    } catch (err) {
      console.error("GET /api/working-drawings view-url error:", err);
      res.status(500).json({ error: "Failed to generate URL" });
    }
  });

  // ── Revision control endpoints ────────────────────────────────────────────

  // GET /api/working-drawings/:drawingId/revisions — all revisions, newest first
  app.get("/api/working-drawings/:drawingId/revisions", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { drawingId } = req.params;
      if (!orgId) return res.status(403).json({ error: "Forbidden" });
      const { db: reqDb } = await import("./db");
      const { drawingRevisions: dr, drawings: drawingsTable, users } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      const [drawing] = await reqDb.select().from(drawingsTable)
        .where(and(eq(drawingsTable.id, drawingId), eq(drawingsTable.orgId, orgId)));
      if (!drawing) return res.status(404).json({ error: "Drawing not found" });
      const rows = await reqDb
        .select({ rev: dr, uploaderName: users.name, uploaderFirst: users.firstName, uploaderLast: users.lastName })
        .from(dr)
        .leftJoin(users, eq(dr.uploadedBy, users.id))
        .where(and(eq(dr.drawingId, drawingId), eq(dr.orgId, orgId)))
        .orderBy(desc(dr.revisionLetter));
      res.json(rows.map(r => ({
        ...r.rev,
        uploaderName: r.uploaderName || [r.uploaderFirst, r.uploaderLast].filter(Boolean).join(" ") || null,
      })));
    } catch (err) {
      console.error("GET /api/working-drawings/:id/revisions error:", err);
      res.status(500).json({ error: "Failed to fetch revisions" });
    }
  });

  // POST /api/working-drawings/:drawingId/revisions — upload a new revision file
  app.post("/api/working-drawings/:drawingId/revisions", requireAuth, drawingBatchUpload.single("file"), async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.id;
      const { drawingId } = req.params;
      if (!orgId) return res.status(403).json({ error: "Forbidden" });
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const { db: reqDb } = await import("./db");
      const { drawingRevisions: dr, drawings: drawingsTable, revisionEvents } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [drawing] = await reqDb.select().from(drawingsTable)
        .where(and(eq(drawingsTable.id, drawingId), eq(drawingsTable.orgId, orgId)));
      if (!drawing) return res.status(404).json({ error: "Drawing not found" });

      // Determine next revision letter
      const existing = await reqDb.select({ letter: dr.revisionLetter }).from(dr)
        .where(and(eq(dr.drawingId, drawingId), eq(dr.orgId, orgId)));
      const letters = existing.map(r => r.letter);
      function nextLetter(ls: string[]): string {
        if (ls.length === 0) return 'A';
        const last = [...ls].sort().at(-1)!;
        if (last === 'Z') return 'AA';
        if (last.length === 1) return String.fromCharCode(last.charCodeAt(0) + 1);
        const chars = last.split('');
        let i = chars.length - 1;
        while (i >= 0) {
          if (chars[i] < 'Z') { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); break; }
          chars[i] = 'A'; i--;
        }
        if (i < 0) chars.unshift('A');
        return chars.join('');
      }
      const newLetter = nextLetter(letters);

      // Mark all existing revisions as superseded
      if (existing.length > 0) {
        await reqDb.update(dr).set({ state: "superseded", supersededAt: new Date() })
          .where(and(eq(dr.drawingId, drawingId), eq(dr.orgId, orgId)));
      }

      // Upload file
      const objectPath = await uploadToObjectStorage(file.buffer, file.originalname, userId, file.mimetype, orgId);

      // Insert new revision
      const revisionId = randomUUID();
      const revisionNote = typeof req.body.revisionNote === "string" ? req.body.revisionNote.trim() || null : null;
      const [newRev] = await reqDb.insert(dr).values({
        id: revisionId,
        orgId,
        drawingId,
        revisionLetter: newLetter,
        filePath: objectPath,
        fileName: file.originalname,
        fileSize: file.size,
        fileMimeType: file.mimetype,
        state: "draft",
        revisionNote,
        uploadedBy: userId,
        uploadedAt: new Date(),
      }).returning();

      // Update drawing status
      await reqDb.update(drawingsTable).set({ status: "drafting", updatedAt: new Date() })
        .where(and(eq(drawingsTable.id, drawingId), eq(drawingsTable.orgId, orgId)));

      await reqDb.insert(revisionEvents).values({
        id: randomUUID(), orgId, revisionId, eventType: "uploaded", actorId: userId, createdAt: new Date(),
      });

      res.json(newRev);
    } catch (err) {
      console.error("POST /api/working-drawings/:id/revisions error:", err);
      res.status(500).json({ error: "Failed to upload revision" });
    }
  });

  // PATCH /api/working-drawings/:drawingId/revisions/:revisionId/state — change revision state
  app.patch("/api/working-drawings/:drawingId/revisions/:revisionId/state", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { drawingId, revisionId } = req.params;
      const { state } = req.body;
      if (!orgId) return res.status(403).json({ error: "Forbidden" });
      const allowed = ["draft", "for_review", "approved"];
      if (!allowed.includes(state)) return res.status(400).json({ error: "Invalid state" });
      if (state === "approved" && userRole !== "client" && userRole !== "designer") {
        return res.status(403).json({ error: "Only clients and designers can approve drawings" });
      }

      const { db: reqDb } = await import("./db");
      const { drawingRevisions: dr, drawings: drawingsTable, revisionEvents } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [rev] = await reqDb.select().from(dr)
        .where(and(eq(dr.id, revisionId), eq(dr.drawingId, drawingId), eq(dr.orgId, orgId)));
      if (!rev) return res.status(404).json({ error: "Revision not found" });

      const updates: Record<string, unknown> = { state };
      if (state === "approved") updates.approvedAt = new Date();
      if (state === "for_review") updates.issuedAt = new Date();

      const [updated] = await reqDb.update(dr).set(updates)
        .where(and(eq(dr.id, revisionId), eq(dr.orgId, orgId))).returning();

      // Sync drawing.status
      const drawingStatus = state === "approved" ? "approved" : state === "for_review" ? "for_review" : "drafting";
      await reqDb.update(drawingsTable).set({ status: drawingStatus, updatedAt: new Date() })
        .where(and(eq(drawingsTable.id, drawingId), eq(drawingsTable.orgId, orgId)));

      const eventMap: Record<string, string> = { for_review: "issued_for_review", approved: "approved", draft: "returned_with_comments" };
      await reqDb.insert(revisionEvents).values({
        id: randomUUID(), orgId, revisionId, eventType: eventMap[state] ?? state, actorId: userId, createdAt: new Date(),
      });

      res.json(updated);
    } catch (err) {
      console.error("PATCH /api/working-drawings/:id/revisions/:revId/state error:", err);
      res.status(500).json({ error: "Failed to update state" });
    }
  });

  // ── Drawing Categories ────────────────────────────────────────────────────

  // GET /api/working-drawings/categories — list org-level custom drawing categories
  app.get("/api/working-drawings/categories", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(400).json({ error: "orgId required" });
      const { eq } = await import("drizzle-orm");
      const { drawingCategories } = await import("@shared/schema");
      const result = await db.select().from(drawingCategories).where(eq(drawingCategories.orgId, orgId)).orderBy(drawingCategories.name);
      res.json(result);
    } catch (err) {
      console.error("GET /api/working-drawings/categories error:", err);
      res.status(500).json({ error: "Failed to fetch drawing categories" });
    }
  });

  // POST /api/working-drawings/categories — create a custom drawing category
  app.post("/api/working-drawings/categories", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { name } = req.body as { name?: string };
      if (!orgId || !name?.trim()) return res.status(400).json({ error: "name is required" });
      const { drawingCategories } = await import("@shared/schema");
      const [result] = await db.insert(drawingCategories).values({ orgId, name: name.trim() }).returning();
      res.status(201).json(result);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ error: "A category with that name already exists." });
      console.error("POST /api/working-drawings/categories error:", err);
      res.status(500).json({ error: "Failed to create drawing category" });
    }
  });

  // DELETE /api/working-drawings/categories/:id — delete a custom drawing category
  app.delete("/api/working-drawings/categories/:id", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { eq, and } = await import("drizzle-orm");
      const { drawingCategories } = await import("@shared/schema");
      await db.delete(drawingCategories).where(and(eq(drawingCategories.id, id), eq(drawingCategories.orgId, orgId)));
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /api/working-drawings/categories/:id error:", err);
      res.status(500).json({ error: "Failed to delete drawing category" });
    }
  });

  // ─── Client Briefs ──────────────────────────────────────────────────────────
  app.get("/api/client-briefs", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(400).json({ error: "orgId required" });
      const { eq, desc } = await import("drizzle-orm");
      const { clientBriefs } = await import("@shared/schema");
      const result = await db.select().from(clientBriefs).where(eq(clientBriefs.orgId, orgId)).orderBy(desc(clientBriefs.createdAt));
      res.json(result);
    } catch (err) {
      console.error("GET /api/client-briefs error:", err);
      res.status(500).json({ error: "Failed to fetch client briefs" });
    }
  });

  app.post("/api/client-briefs", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(400).json({ error: "orgId required" });
      const { clientBriefs, insertClientBriefSchema } = await import("@shared/schema");
      const parsed = insertClientBriefSchema.safeParse({ ...req.body, orgId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message });
      const [result] = await db.insert(clientBriefs).values(parsed.data).returning();
      res.status(201).json(result);
    } catch (err) {
      console.error("POST /api/client-briefs error:", err);
      res.status(500).json({ error: "Failed to create client brief" });
    }
  });

  app.get("/api/client-briefs/:id", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { eq, and } = await import("drizzle-orm");
      const { clientBriefs } = await import("@shared/schema");
      const [result] = await db.select().from(clientBriefs).where(and(eq(clientBriefs.id, id), eq(clientBriefs.orgId, orgId)));
      if (!result) return res.status(404).json({ error: "Not found" });
      res.json(result);
    } catch (err) {
      console.error("GET /api/client-briefs/:id error:", err);
      res.status(500).json({ error: "Failed to fetch client brief" });
    }
  });

  app.put("/api/client-briefs/:id", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { eq, and, sql: sqlFn } = await import("drizzle-orm");
      const { clientBriefs } = await import("@shared/schema");
      const { id: _id, orgId: _org, createdAt: _ca, ...updateData } = req.body;
      const [result] = await db.update(clientBriefs)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(clientBriefs.id, id), eq(clientBriefs.orgId, orgId)))
        .returning();
      if (!result) return res.status(404).json({ error: "Not found" });
      res.json(result);
    } catch (err) {
      console.error("PUT /api/client-briefs/:id error:", err);
      res.status(500).json({ error: "Failed to update client brief" });
    }
  });

  app.delete("/api/client-briefs/:id", requireAdmin, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { eq, and } = await import("drizzle-orm");
      const { clientBriefs } = await import("@shared/schema");
      await db.delete(clientBriefs).where(and(eq(clientBriefs.id, id), eq(clientBriefs.orgId, orgId)));
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /api/client-briefs/:id error:", err);
      res.status(500).json({ error: "Failed to delete client brief" });
    }
  });

  const briefRefUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  app.post("/api/client-briefs/:id/references", requireAuth, briefRefUpload.array('files', 10), async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.id;
      const { id } = req.params;
      const { eq, and } = await import("drizzle-orm");
      const { clientBriefs } = await import("@shared/schema");
      const [brief] = await db.select().from(clientBriefs).where(and(eq(clientBriefs.id, id), eq(clientBriefs.orgId, orgId)));
      if (!brief) return res.status(404).json({ error: "Not found" });
      const files = (req.files || []) as Express.Multer.File[];
      const newRefs = [...((brief.referenceFiles as any[]) || [])];
      for (const file of files) {
        const objectPath = await uploadToObjectStorage(file.buffer, file.originalname, userId, file.mimetype, orgId);
        newRefs.push({ name: file.originalname, path: objectPath, mimeType: file.mimetype, size: file.size });
      }
      const [updated] = await db.update(clientBriefs)
        .set({ referenceFiles: newRefs, updatedAt: new Date() })
        .where(and(eq(clientBriefs.id, id), eq(clientBriefs.orgId, orgId)))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("POST /api/client-briefs/:id/references error:", err);
      res.status(500).json({ error: "Failed to upload references" });
    }
  });

  app.delete("/api/client-briefs/:id/references", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { filePath } = req.body;
      const { eq, and } = await import("drizzle-orm");
      const { clientBriefs } = await import("@shared/schema");
      const [brief] = await db.select().from(clientBriefs).where(and(eq(clientBriefs.id, id), eq(clientBriefs.orgId, orgId)));
      if (!brief) return res.status(404).json({ error: "Not found" });
      const refs = ((brief.referenceFiles as any[]) || []).filter((f: any) => f.path !== filePath);
      const [updated] = await db.update(clientBriefs)
        .set({ referenceFiles: refs, updatedAt: new Date() })
        .where(and(eq(clientBriefs.id, id), eq(clientBriefs.orgId, orgId)))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("DELETE /api/client-briefs/:id/references error:", err);
      res.status(500).json({ error: "Failed to remove reference" });
    }
  });

  // ─── Proposals ──────────────────────────────────────────────────────────────
  app.get("/api/proposals", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(400).json({ error: "orgId required" });
      const { eq, desc } = await import("drizzle-orm");
      const { proposals } = await import("@shared/schema");
      const result = await db.select().from(proposals).where(eq(proposals.orgId, orgId)).orderBy(desc(proposals.createdAt));
      res.json(result);
    } catch (err) {
      console.error("GET /api/proposals error:", err);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  app.post("/api/proposals", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(400).json({ error: "orgId required" });
      const { proposals, insertProposalSchema } = await import("@shared/schema");
      const parsed = insertProposalSchema.safeParse({ ...req.body, orgId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message });
      const [result] = await db.insert(proposals).values(parsed.data).returning();
      res.status(201).json(result);
    } catch (err) {
      console.error("POST /api/proposals error:", err);
      res.status(500).json({ error: "Failed to create proposal" });
    }
  });

  app.get("/api/proposals/:id", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { eq, and } = await import("drizzle-orm");
      const { proposals } = await import("@shared/schema");
      const [result] = await db.select().from(proposals).where(and(eq(proposals.id, id), eq(proposals.orgId, orgId)));
      if (!result) return res.status(404).json({ error: "Not found" });
      res.json(result);
    } catch (err) {
      console.error("GET /api/proposals/:id error:", err);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  });

  app.put("/api/proposals/:id", requireAuth, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { eq, and } = await import("drizzle-orm");
      const { proposals } = await import("@shared/schema");
      const { id: _id, orgId: _org, createdAt: _ca, ...updateData } = req.body;
      const [result] = await db.update(proposals)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(proposals.id, id), eq(proposals.orgId, orgId)))
        .returning();
      if (!result) return res.status(404).json({ error: "Not found" });
      res.json(result);
    } catch (err) {
      console.error("PUT /api/proposals/:id error:", err);
      res.status(500).json({ error: "Failed to update proposal" });
    }
  });

  app.delete("/api/proposals/:id", requireAdmin, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      const { id } = req.params;
      const { eq, and } = await import("drizzle-orm");
      const { proposals } = await import("@shared/schema");
      await db.delete(proposals).where(and(eq(proposals.id, id), eq(proposals.orgId, orgId)));
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE /api/proposals/:id error:", err);
      res.status(500).json({ error: "Failed to delete proposal" });
    }
  });

  // Run immediately on startup, then every 24 hours
  runTrialExpiryWarnings();
  setInterval(runTrialExpiryWarnings, 24 * 60 * 60 * 1000);

  return httpServer;
}
