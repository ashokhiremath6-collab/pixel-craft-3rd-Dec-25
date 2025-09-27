import { 
  type User, 
  type InsertUser,
  type UserProjectAccess,
  type InsertUserProjectAccess,
  type DesignerAllowlist,
  type InsertDesignerAllowlist,
  type VendorCategory,
  type InsertVendorCategory,
  type Vendor,
  type InsertVendor,
  type Project,
  type InsertProject,
  type ProjectVendor,
  type InsertProjectVendor,
  type QuoteTemplate,
  type InsertQuoteTemplate,
  type Boq,
  type InsertBoq,
  type QuoteFile,
  type InsertQuoteFile,
  type FloorPlan,
  type InsertFloorPlan,
  users,
  userProjectAccess,
  designerAllowlist,
  vendorCategories,
  vendors,
  projects,
  projectVendors,
  quoteTemplates,
  boq,
  quoteFiles,
  floorPlans,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, inArray, isNull, and } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Users
  getAllUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  updateUserLastLogin(id: string): Promise<void>;
  
  // User Project Access
  getUserProjectAccess(userId: string): Promise<UserProjectAccess[]>;
  getProjectUsers(projectId: string): Promise<UserProjectAccess[]>;
  createUserProjectAccess(access: InsertUserProjectAccess): Promise<UserProjectAccess>;
  deleteUserProjectAccess(userId: string, projectId: string): Promise<boolean>;
  getUserAccessibleProjects(userId: string): Promise<string[]>;
  
  // Designer Allowlist
  getDesignerAllowlist(): Promise<DesignerAllowlist[]>;
  addToDesignerAllowlist(allowlist: InsertDesignerAllowlist): Promise<DesignerAllowlist>;
  removeFromDesignerAllowlist(email: string): Promise<boolean>;
  isDesignerEmail(email: string): Promise<boolean>;
  
  // Role-based access helpers
  getProjectsForUser(userId: string, role: string): Promise<Project[]>;
  getProjectVendorsForUser(userId: string, role: string, projectId?: string): Promise<ProjectVendor[]>;
  getBOQForUser(userId: string, role: string, projectVendorId: string): Promise<Boq[]>;
  getQuoteFilesForUser(userId: string, role: string, projectVendorId: string): Promise<QuoteFile[]>;
  getFloorPlansForUser(userId: string, role: string, projectId?: string): Promise<FloorPlan[]>;
  
  // Vendor Categories
  getAllVendorCategories(): Promise<VendorCategory[]>;
  getVendorCategory(id: string): Promise<VendorCategory | undefined>;
  getChildCategories(parentId: string | null): Promise<VendorCategory[]>;
  getCategoryTree(): Promise<VendorCategory[]>;
  getCategoryWithDescendants(categoryId: string): Promise<string[]>;
  createVendorCategory(category: InsertVendorCategory): Promise<VendorCategory>;
  updateVendorCategory(id: string, category: Partial<InsertVendorCategory>): Promise<VendorCategory | undefined>;
  deleteVendorCategory(id: string): Promise<boolean>;
  
  // Vendors
  getAllVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  getVendorsByCategory(categoryId: string): Promise<Vendor[]>;
  getVendorsByCategoryWithDescendants(categoryId: string): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;
  
  // Projects
  getAllProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Project Vendors
  getAllProjectVendors(): Promise<ProjectVendor[]>;
  getProjectVendors(projectId: string): Promise<ProjectVendor[]>;
  getProjectVendor(id: string): Promise<ProjectVendor | undefined>;
  createProjectVendor(projectVendor: InsertProjectVendor): Promise<ProjectVendor>;
  upsertProjectVendor(projectVendor: InsertProjectVendor): Promise<ProjectVendor>;
  updateProjectVendor(id: string, projectVendor: Partial<InsertProjectVendor>): Promise<ProjectVendor | undefined>;
  deleteProjectVendor(id: string): Promise<boolean>;
  
  // Quote Templates
  getAllQuoteTemplates(): Promise<QuoteTemplate[]>;
  getQuoteTemplate(id: string): Promise<QuoteTemplate | undefined>;
  getQuoteTemplateWithFileData(id: string): Promise<QuoteTemplate | undefined>;
  getQuoteTemplatesByCategory(categoryId: string): Promise<QuoteTemplate[]>;
  createQuoteTemplate(template: InsertQuoteTemplate): Promise<QuoteTemplate>;
  updateQuoteTemplate(id: string, template: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate | undefined>;
  deleteQuoteTemplate(id: string): Promise<boolean>;
  
  // BOQ (Bill of Quantities)
  getBOQByProjectVendor(projectVendorId: string): Promise<Boq[]>;
  getBOQ(id: string): Promise<Boq | undefined>;
  createBOQ(boq: InsertBoq): Promise<Boq>;
  createBOQBatch(boqs: InsertBoq[]): Promise<Boq[]>;
  updateBOQ(id: string, boq: Partial<InsertBoq>): Promise<Boq | undefined>;
  deleteBOQ(id: string): Promise<boolean>;
  deleteBOQByProjectVendor(projectVendorId: string): Promise<boolean>;
  
  // Quote Files
  getQuoteFilesByProjectVendor(projectVendorId: string): Promise<QuoteFile[]>;
  getQuoteFile(id: string): Promise<QuoteFile | undefined>;
  createQuoteFile(quoteFile: InsertQuoteFile): Promise<QuoteFile>;
  updateQuoteFile(id: string, quoteFile: Partial<InsertQuoteFile>): Promise<QuoteFile | undefined>;
  deleteQuoteFile(id: string): Promise<boolean>;
  
  // Floor Plans
  getAllFloorPlans(): Promise<FloorPlan[]>;
  getFloorPlansByProject(projectId: string): Promise<FloorPlan[]>;
  getFloorPlan(id: string): Promise<FloorPlan | undefined>;
  createFloorPlan(floorPlan: InsertFloorPlan): Promise<FloorPlan>;
  updateFloorPlan(id: string, floorPlan: Partial<InsertFloorPlan>): Promise<FloorPlan | undefined>;
  deleteFloorPlan(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private userProjectAccess: Map<string, UserProjectAccess>;
  private vendorCategories: Map<string, VendorCategory>;
  private vendors: Map<string, Vendor>;
  private projects: Map<string, Project>;
  private projectVendors: Map<string, ProjectVendor>;
  private quoteTemplates: Map<string, QuoteTemplate>;
  private boq: Map<string, Boq>;
  private quoteFiles: Map<string, QuoteFile>;
  private floorPlans: Map<string, FloorPlan>;

  constructor() {
    this.users = new Map();
    this.userProjectAccess = new Map();
    this.vendorCategories = new Map();
    this.vendors = new Map();
    this.projects = new Map();
    this.projectVendors = new Map();
    this.quoteTemplates = new Map();
    this.boq = new Map();
    this.quoteFiles = new Map();
    this.floorPlans = new Map();
    
    // No dummy data needed - using database storage
  }

  // Removed dummy data methods - using database storage

  // User methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      password: insertUser.password || null,
      role: insertUser.role || "client",
      authProvider: insertUser.authProvider || "local",
      googleId: insertUser.googleId || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profilePicture: insertUser.profilePicture || null,
      isActive: insertUser.isActive ?? true,
      lastLoginAt: null,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, userUpdate: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser: User = { ...existingUser, ...userUpdate };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // OAuth support methods  
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.googleId === googleId,
    );
  }

  async updateUserLastLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
      this.users.set(id, user);
    }
  }

  // Designer Allowlist methods (MemStorage - not used in production)
  async getDesignerAllowlist(): Promise<DesignerAllowlist[]> {
    return []; // MemStorage doesn't store allowlist
  }

  async addToDesignerAllowlist(allowlist: InsertDesignerAllowlist): Promise<DesignerAllowlist> {
    throw new Error("MemStorage doesn't support designer allowlist");
  }

  async removeFromDesignerAllowlist(email: string): Promise<boolean> {
    return false;
  }

  async isDesignerEmail(email: string): Promise<boolean> {
    return email === 'admin@company.com'; // Hardcoded for MemStorage
  }

  // Role-based access helpers (MemStorage - simplified)
  async getProjectsForUser(userId: string, role: string): Promise<Project[]> {
    if (role === 'designer') {
      return Array.from(this.projects.values());
    }
    const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
    return Array.from(this.projects.values()).filter(p => accessibleProjectIds.includes(p.id));
  }

  async getProjectVendorsForUser(userId: string, role: string, projectId?: string): Promise<ProjectVendor[]> {
    if (role === 'designer') {
      return projectId ? 
        Array.from(this.projectVendors.values()).filter(pv => pv.projectId === projectId) :
        Array.from(this.projectVendors.values());
    }
    const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
    return Array.from(this.projectVendors.values()).filter(pv => 
      accessibleProjectIds.includes(pv.projectId) && (!projectId || pv.projectId === projectId)
    );
  }

  async getBOQForUser(userId: string, role: string, projectVendorId: string): Promise<Boq[]> {
    if (role === 'designer') {
      return Array.from(this.boq.values()).filter(b => b.projectVendorId === projectVendorId);
    }
    // Check if user has access to the project vendor's project
    const projectVendor = this.projectVendors.get(projectVendorId);
    if (!projectVendor) return [];
    const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
    if (!accessibleProjectIds.includes(projectVendor.projectId)) return [];
    return Array.from(this.boq.values()).filter(b => b.projectVendorId === projectVendorId);
  }

  async getQuoteFilesForUser(userId: string, role: string, projectVendorId: string): Promise<QuoteFile[]> {
    if (role === 'designer') {
      return Array.from(this.quoteFiles.values()).filter(f => f.projectVendorId === projectVendorId);
    }
    // Check if user has access to the project vendor's project
    const projectVendor = this.projectVendors.get(projectVendorId);
    if (!projectVendor) return [];
    const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
    if (!accessibleProjectIds.includes(projectVendor.projectId)) return [];
    return Array.from(this.quoteFiles.values()).filter(f => f.projectVendorId === projectVendorId);
  }

  async getFloorPlansForUser(userId: string, role: string, projectId?: string): Promise<FloorPlan[]> {
    if (role === 'designer') {
      return projectId ?
        Array.from(this.floorPlans.values()).filter(f => f.projectId === projectId) :
        Array.from(this.floorPlans.values());
    }
    const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
    return Array.from(this.floorPlans.values()).filter(f => 
      accessibleProjectIds.includes(f.projectId) && (!projectId || f.projectId === projectId)
    );
  }

  // User Project Access methods (MemStorage uses maps)
  async getUserProjectAccess(userId: string): Promise<UserProjectAccess[]> {
    return Array.from(this.userProjectAccess.values()).filter(
      (access) => access.userId === userId
    );
  }

  async getProjectUsers(projectId: string): Promise<UserProjectAccess[]> {
    return Array.from(this.userProjectAccess.values()).filter(
      (access) => access.projectId === projectId
    );
  }

  async createUserProjectAccess(access: InsertUserProjectAccess): Promise<UserProjectAccess> {
    const id = randomUUID();
    const userProjectAccess: UserProjectAccess = {
      ...access,
      id,
      accessLevel: access.accessLevel || "read",
      assignedAt: new Date()
    };
    this.userProjectAccess.set(id, userProjectAccess);
    return userProjectAccess;
  }

  async deleteUserProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const existing = Array.from(this.userProjectAccess.entries()).find(
      ([_, access]) => access.userId === userId && access.projectId === projectId
    );
    if (existing) {
      this.userProjectAccess.delete(existing[0]);
      return true;
    }
    return false;
  }

  async getUserAccessibleProjects(userId: string): Promise<string[]> {
    const userAccess = await this.getUserProjectAccess(userId);
    return userAccess.map(access => access.projectId);
  }

  // Vendor Category methods
  async getAllVendorCategories(): Promise<VendorCategory[]> {
    return Array.from(this.vendorCategories.values());
  }

  async getVendorCategory(id: string): Promise<VendorCategory | undefined> {
    return this.vendorCategories.get(id);
  }

  async createVendorCategory(insertCategory: InsertVendorCategory): Promise<VendorCategory> {
    const id = randomUUID();
    const category: VendorCategory = { 
      ...insertCategory, 
      id,
      parentId: insertCategory.parentId || null,
      description: insertCategory.description || null,
      isActive: insertCategory.isActive ?? true
    };
    this.vendorCategories.set(id, category);
    return category;
  }

  async updateVendorCategory(id: string, updates: Partial<InsertVendorCategory>): Promise<VendorCategory | undefined> {
    const existing = this.vendorCategories.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.vendorCategories.set(id, updated);
    return updated;
  }

  async deleteVendorCategory(id: string): Promise<boolean> {
    // Check if category has children or vendors before deleting
    const hasChildren = Array.from(this.vendorCategories.values()).some(cat => cat.parentId === id);
    const hasVendors = Array.from(this.vendors.values()).some(vendor => vendor.categoryId === id);
    
    if (hasChildren || hasVendors) {
      throw new Error("Cannot delete category with child categories or vendors");
    }
    
    return this.vendorCategories.delete(id);
  }

  async getChildCategories(parentId: string | null): Promise<VendorCategory[]> {
    return Array.from(this.vendorCategories.values()).filter(
      category => category.parentId === parentId
    );
  }

  async getCategoryTree(): Promise<VendorCategory[]> {
    // Return all categories sorted by parentId (parents first, then children)
    const allCategories = Array.from(this.vendorCategories.values());
    const rootCategories = allCategories.filter(cat => cat.parentId === null);
    const childCategories = allCategories.filter(cat => cat.parentId !== null);
    
    return [...rootCategories, ...childCategories];
  }

  async getCategoryWithDescendants(categoryId: string): Promise<string[]> {
    const descendants = [categoryId];
    
    const findChildren = (parentId: string) => {
      const children = Array.from(this.vendorCategories.values()).filter(cat => cat.parentId === parentId);
      for (const child of children) {
        descendants.push(child.id);
        findChildren(child.id); // Recursively find grandchildren
      }
    };
    
    findChildren(categoryId);
    return descendants;
  }

  // Vendor methods
  async getAllVendors(): Promise<Vendor[]> {
    return Array.from(this.vendors.values());
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    return this.vendors.get(id);
  }

  async getVendorsByCategory(categoryId: string): Promise<Vendor[]> {
    return Array.from(this.vendors.values()).filter(
      vendor => vendor.categoryId === categoryId
    );
  }

  async getVendorsByCategoryWithDescendants(categoryId: string): Promise<Vendor[]> {
    // Get all descendant category IDs including the parent
    const categoryIds = await this.getCategoryWithDescendants(categoryId);
    
    // Return vendors that belong to any of these categories
    return Array.from(this.vendors.values()).filter(
      vendor => categoryIds.includes(vendor.categoryId)
    );
  }

  async createVendor(insertVendor: InsertVendor): Promise<Vendor> {
    const id = randomUUID();
    const vendor: Vendor = { 
      ...insertVendor, 
      id,
      notes: insertVendor.notes || null
    };
    this.vendors.set(id, vendor);
    return vendor;
  }

  async updateVendor(id: string, updates: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const existing = this.vendors.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.vendors.set(id, updated);
    return updated;
  }

  async deleteVendor(id: string): Promise<boolean> {
    return this.vendors.delete(id);
  }

  // Project methods
  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = { 
      ...insertProject, 
      id,
      endDate: insertProject.endDate || null
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Project Vendors
  async getAllProjectVendors(): Promise<ProjectVendor[]> {
    return Array.from(this.projectVendors.values());
  }

  async getProjectVendors(projectId: string): Promise<ProjectVendor[]> {
    return Array.from(this.projectVendors.values()).filter(
      pv => pv.projectId === projectId
    );
  }

  async getProjectVendor(id: string): Promise<ProjectVendor | undefined> {
    return this.projectVendors.get(id);
  }

  async createProjectVendor(insertProjectVendor: InsertProjectVendor): Promise<ProjectVendor> {
    const id = randomUUID();
    const projectVendor: ProjectVendor = { 
      ...insertProjectVendor, 
      id,
      quotationFile: insertProjectVendor.quotationFile || null,
      quotationValue: insertProjectVendor.quotationValue || null,
      dateOfQuotation: insertProjectVendor.dateOfQuotation || null,
      notes: insertProjectVendor.notes || null,
      templateId: insertProjectVendor.templateId || null,
      status: insertProjectVendor.status || "Quoted",
      submittedAt: new Date()
    };
    this.projectVendors.set(id, projectVendor);
    return projectVendor;
  }

  async upsertProjectVendor(insertProjectVendor: InsertProjectVendor): Promise<ProjectVendor> {
    // Check if project-vendor relationship already exists
    const existingProjectVendor = Array.from(this.projectVendors.values()).find(
      pv => pv.projectId === insertProjectVendor.projectId && pv.vendorId === insertProjectVendor.vendorId
    );

    if (existingProjectVendor) {
      // Update existing record
      const updated = { 
        ...existingProjectVendor, 
        ...insertProjectVendor,
        quotationFile: insertProjectVendor.quotationFile || existingProjectVendor.quotationFile,
        quotationValue: insertProjectVendor.quotationValue || existingProjectVendor.quotationValue,
        dateOfQuotation: insertProjectVendor.dateOfQuotation || existingProjectVendor.dateOfQuotation,
        notes: insertProjectVendor.notes || existingProjectVendor.notes,
        templateId: insertProjectVendor.templateId || existingProjectVendor.templateId,
        submittedAt: existingProjectVendor.submittedAt // Keep original submission time
      };
      this.projectVendors.set(existingProjectVendor.id, updated);
      return updated;
    } else {
      // Create new record
      return await this.createProjectVendor(insertProjectVendor);
    }
  }

  async updateProjectVendor(id: string, updates: Partial<InsertProjectVendor>): Promise<ProjectVendor | undefined> {
    const existing = this.projectVendors.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.projectVendors.set(id, updated);
    return updated;
  }

  async deleteProjectVendor(id: string): Promise<boolean> {
    return this.projectVendors.delete(id);
  }

  // Quote Templates
  async getAllQuoteTemplates(): Promise<QuoteTemplate[]> {
    return Array.from(this.quoteTemplates.values()).map(template => {
      // Exclude originalFileData to avoid bloating API responses
      const { originalFileData, ...templateWithoutFileData } = template;
      return templateWithoutFileData as QuoteTemplate;
    });
  }

  async getQuoteTemplate(id: string): Promise<QuoteTemplate | undefined> {
    const template = this.quoteTemplates.get(id);
    if (!template) return undefined;
    // Exclude originalFileData to avoid bloating API responses
    const { originalFileData, ...templateWithoutFileData } = template;
    return templateWithoutFileData as QuoteTemplate;
  }

  async getQuoteTemplateWithFileData(id: string): Promise<QuoteTemplate | undefined> {
    // Include originalFileData for downloads
    return this.quoteTemplates.get(id);
  }

  async getQuoteTemplatesByCategory(categoryId: string): Promise<QuoteTemplate[]> {
    return Array.from(this.quoteTemplates.values()).filter(
      template => template.categoryId === categoryId
    ).map(template => {
      // Exclude originalFileData to avoid bloating API responses
      const { originalFileData, ...templateWithoutFileData } = template;
      return templateWithoutFileData as QuoteTemplate;
    });
  }

  async createQuoteTemplate(insertTemplate: InsertQuoteTemplate): Promise<QuoteTemplate> {
    const id = randomUUID();
    const template: QuoteTemplate = { 
      ...insertTemplate, 
      id,
      description: insertTemplate.description || null,
      templateFile: insertTemplate.templateFile || null,
      fields: insertTemplate.fields || null,
      originalFileData: insertTemplate.originalFileData || null,
      originalFileName: insertTemplate.originalFileName || null,
      originalMimeType: insertTemplate.originalMimeType || null,
      isActive: insertTemplate.isActive ?? true,
      createdAt: new Date()
    };
    this.quoteTemplates.set(id, template);
    return template;
  }

  async updateQuoteTemplate(id: string, updates: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate | undefined> {
    const existing = this.quoteTemplates.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.quoteTemplates.set(id, updated);
    return updated;
  }

  async deleteQuoteTemplate(id: string): Promise<boolean> {
    return this.quoteTemplates.delete(id);
  }

  // BOQ (Bill of Quantities)
  async getBOQByProjectVendor(projectVendorId: string): Promise<Boq[]> {
    return Array.from(this.boq.values()).filter(
      boq => boq.projectVendorId === projectVendorId
    );
  }

  async getBOQ(id: string): Promise<Boq | undefined> {
    return this.boq.get(id);
  }

  async createBOQ(insertBoq: InsertBoq): Promise<Boq> {
    const id = randomUUID();
    const boq: Boq = { 
      ...insertBoq, 
      id,
      category: insertBoq.category || null,
      itemCode: insertBoq.itemCode || null,
      specifications: insertBoq.specifications || null
    };
    this.boq.set(id, boq);
    return boq;
  }

  async createBOQBatch(boqs: InsertBoq[]): Promise<Boq[]> {
    const createdBOQs: Boq[] = [];
    for (const insertBoq of boqs) {
      const created = await this.createBOQ(insertBoq);
      createdBOQs.push(created);
    }
    return createdBOQs;
  }

  async updateBOQ(id: string, updates: Partial<InsertBoq>): Promise<Boq | undefined> {
    const existing = this.boq.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.boq.set(id, updated);
    return updated;
  }

  async deleteBOQ(id: string): Promise<boolean> {
    return this.boq.delete(id);
  }

  async deleteBOQByProjectVendor(projectVendorId: string): Promise<boolean> {
    const boqItems = Array.from(this.boq.values()).filter(
      boq => boq.projectVendorId === projectVendorId
    );
    
    let deletedCount = 0;
    for (const boqItem of boqItems) {
      if (this.boq.delete(boqItem.id)) {
        deletedCount++;
      }
    }
    
    return deletedCount > 0;
  }

  // Quote Files
  async getQuoteFilesByProjectVendor(projectVendorId: string): Promise<QuoteFile[]> {
    return Array.from(this.quoteFiles.values()).filter(
      file => file.projectVendorId === projectVendorId
    );
  }

  async getQuoteFile(id: string): Promise<QuoteFile | undefined> {
    return this.quoteFiles.get(id);
  }

  async createQuoteFile(insertQuoteFile: InsertQuoteFile): Promise<QuoteFile> {
    const id = randomUUID();
    const quoteFile: QuoteFile = { 
      ...insertQuoteFile, 
      id,
      fileSize: insertQuoteFile.fileSize || null,
      externalStorageProvider: insertQuoteFile.externalStorageProvider || null,
      externalFileId: insertQuoteFile.externalFileId || null,
      uploadedAt: new Date()
    };
    this.quoteFiles.set(id, quoteFile);
    return quoteFile;
  }

  async updateQuoteFile(id: string, updates: Partial<InsertQuoteFile>): Promise<QuoteFile | undefined> {
    const existing = this.quoteFiles.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.quoteFiles.set(id, updated);
    return updated;
  }

  async deleteQuoteFile(id: string): Promise<boolean> {
    return this.quoteFiles.delete(id);
  }

  // Floor Plans
  async getAllFloorPlans(): Promise<FloorPlan[]> {
    return Array.from(this.floorPlans.values());
  }

  async getFloorPlansByProject(projectId: string): Promise<FloorPlan[]> {
    return Array.from(this.floorPlans.values()).filter(
      plan => plan.projectId === projectId
    );
  }

  async getFloorPlan(id: string): Promise<FloorPlan | undefined> {
    return this.floorPlans.get(id);
  }

  async createFloorPlan(insertFloorPlan: InsertFloorPlan): Promise<FloorPlan> {
    const id = randomUUID();
    const floorPlan: FloorPlan = { 
      ...insertFloorPlan, 
      id,
      description: insertFloorPlan.description || null,
      fileSize: insertFloorPlan.fileSize || null,
      version: insertFloorPlan.version || "1.0",
      isActive: insertFloorPlan.isActive ?? true,
      uploadedAt: new Date()
    };
    this.floorPlans.set(id, floorPlan);
    return floorPlan;
  }

  async updateFloorPlan(id: string, updates: Partial<InsertFloorPlan>): Promise<FloorPlan | undefined> {
    const existing = this.floorPlans.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.floorPlans.set(id, updated);
    return updated;
  }

  async deleteFloorPlan(id: string): Promise<boolean> {
    return this.floorPlans.delete(id);
  }
}

export class DBStorage implements IStorage {
  // Users
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, userUpdate: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(userUpdate).where(eq(users.id, id)).returning();
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.googleId, googleId));
    return result[0];
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  // User Project Access methods
  async getUserProjectAccess(userId: string): Promise<UserProjectAccess[]> {
    return await db.select().from(userProjectAccess).where(eq(userProjectAccess.userId, userId));
  }

  async getProjectUsers(projectId: string): Promise<UserProjectAccess[]> {
    return await db.select().from(userProjectAccess).where(eq(userProjectAccess.projectId, projectId));
  }

  async createUserProjectAccess(access: InsertUserProjectAccess): Promise<UserProjectAccess> {
    const result = await db.insert(userProjectAccess).values(access).returning();
    return result[0];
  }

  async deleteUserProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const result = await db.delete(userProjectAccess)
      .where(and(eq(userProjectAccess.userId, userId), eq(userProjectAccess.projectId, projectId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getUserAccessibleProjects(userId: string): Promise<string[]> {
    const userAccess = await this.getUserProjectAccess(userId);
    return userAccess.map(access => access.projectId);
  }

  // Designer Allowlist methods
  async getDesignerAllowlist(): Promise<DesignerAllowlist[]> {
    return await db.select().from(designerAllowlist).where(eq(designerAllowlist.isActive, true));
  }

  async addToDesignerAllowlist(allowlist: InsertDesignerAllowlist): Promise<DesignerAllowlist> {
    const result = await db.insert(designerAllowlist).values(allowlist).returning();
    return result[0];
  }

  async removeFromDesignerAllowlist(email: string): Promise<boolean> {
    const result = await db.update(designerAllowlist)
      .set({ isActive: false })
      .where(eq(designerAllowlist.email, email));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async isDesignerEmail(email: string): Promise<boolean> {
    const result = await db.select().from(designerAllowlist)
      .where(and(eq(designerAllowlist.email, email), eq(designerAllowlist.isActive, true)));
    return result.length > 0;
  }

  // Vendor Categories
  async getAllVendorCategories(): Promise<VendorCategory[]> {
    return await db.select().from(vendorCategories);
  }

  async getVendorCategory(id: string): Promise<VendorCategory | undefined> {
    const result = await db.select().from(vendorCategories).where(eq(vendorCategories.id, id));
    return result[0];
  }

  async getChildCategories(parentId: string | null): Promise<VendorCategory[]> {
    if (parentId === null) {
      return await db.select().from(vendorCategories).where(isNull(vendorCategories.parentId));
    }
    return await db.select().from(vendorCategories).where(eq(vendorCategories.parentId, parentId));
  }

  async getCategoryTree(): Promise<VendorCategory[]> {
    return await db.select().from(vendorCategories);
  }

  async getCategoryWithDescendants(categoryId: string): Promise<string[]> {
    // Get all categories
    const allCategories = await db.select().from(vendorCategories);
    
    // Build descendant tree (same logic as MemStorage)
    const descendants = [categoryId];
    const toProcess = [categoryId];
    
    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;
      const children = allCategories.filter(cat => cat.parentId === currentId);
      
      for (const child of children) {
        if (!descendants.includes(child.id)) {
          descendants.push(child.id);
          toProcess.push(child.id);
        }
      }
    }
    
    return descendants;
  }

  async createVendorCategory(category: InsertVendorCategory): Promise<VendorCategory> {
    const result = await db.insert(vendorCategories).values(category).returning();
    return result[0];
  }

  async updateVendorCategory(id: string, category: Partial<InsertVendorCategory>): Promise<VendorCategory | undefined> {
    const result = await db.update(vendorCategories).set(category).where(eq(vendorCategories.id, id)).returning();
    return result[0];
  }

  async deleteVendorCategory(id: string): Promise<boolean> {
    // Check if category has children or vendors before deleting
    const hasChildren = await db.select().from(vendorCategories).where(eq(vendorCategories.parentId, id));
    const hasVendors = await db.select().from(vendors).where(eq(vendors.categoryId, id));
    
    if (hasChildren.length > 0 || hasVendors.length > 0) {
      throw new Error("Cannot delete category with child categories or vendors");
    }
    
    const result = await db.delete(vendorCategories).where(eq(vendorCategories.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Vendors
  async getAllVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors);
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const result = await db.select().from(vendors).where(eq(vendors.id, id));
    return result[0];
  }

  async getVendorsByCategory(categoryId: string): Promise<Vendor[]> {
    return await db.select().from(vendors).where(eq(vendors.categoryId, categoryId));
  }

  async getVendorsByCategoryWithDescendants(categoryId: string): Promise<Vendor[]> {
    const categoryIds = await this.getCategoryWithDescendants(categoryId);
    return await db.select().from(vendors).where(inArray(vendors.categoryId, categoryIds));
  }

  async getVendorsWithProjects(): Promise<Array<Vendor & { projects: Array<{ projectId: string; projectName: string; clientName: string; status: string }> }>> {
    const allVendors = await db.select().from(vendors);
    const allProjectVendors = await db.select().from(projectVendors);
    const allProjects = await db.select().from(projects);
    
    // Create project lookup map
    const projectMap = new Map(allProjects.map(p => [p.id, p]));
    
    // Group project vendors by vendor ID
    const vendorProjectsMap = new Map<string, Array<{ projectId: string; projectName: string; clientName: string; status: string }>>();
    
    allProjectVendors.forEach(pv => {
      const project = projectMap.get(pv.projectId);
      if (project) {
        if (!vendorProjectsMap.has(pv.vendorId)) {
          vendorProjectsMap.set(pv.vendorId, []);
        }
        vendorProjectsMap.get(pv.vendorId)!.push({
          projectId: project.id,
          projectName: project.projectName,
          clientName: project.clientName,
          status: pv.status
        });
      }
    });
    
    // Combine vendors with their projects
    return allVendors.map(vendor => ({
      ...vendor,
      projects: vendorProjectsMap.get(vendor.id) || []
    }));
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const result = await db.insert(vendors).values(vendor).returning();
    return result[0];
  }

  async updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const result = await db.update(vendors).set(vendor).where(eq(vendors.id, id)).returning();
    return result[0];
  }

  async deleteVendor(id: string): Promise<boolean> {
    const result = await db.delete(vendors).where(eq(vendors.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Projects
  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects).set(project).where(eq(projects.id, id)).returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Role-based access helper methods
  async getProjectsForUser(userId: string, role: string): Promise<Project[]> {
    if (role === 'designer') {
      // Designers can access all projects
      return await db.select().from(projects);
    } else {
      // Clients can only access projects they have access to
      const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
      if (accessibleProjectIds.length === 0) {
        return [];
      }
      return await db.select().from(projects).where(inArray(projects.id, accessibleProjectIds));
    }
  }

  async getProjectVendorsForUser(userId: string, role: string, projectId?: string): Promise<ProjectVendor[]> {
    if (role === 'designer') {
      // Designers can access all project vendors
      if (projectId) {
        return await db.select().from(projectVendors).where(eq(projectVendors.projectId, projectId));
      }
      return await db.select().from(projectVendors);
    } else {
      // Clients can only access project vendors for their projects
      const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
      if (accessibleProjectIds.length === 0) {
        return [];
      }
      
      if (projectId) {
        // Verify client has access to the specific project
        if (!accessibleProjectIds.includes(projectId)) {
          return [];
        }
        return await db.select().from(projectVendors).where(eq(projectVendors.projectId, projectId));
      }
      
      return await db.select().from(projectVendors).where(inArray(projectVendors.projectId, accessibleProjectIds));
    }
  }

  async getBOQForUser(userId: string, role: string, projectVendorId: string): Promise<Boq[]> {
    if (role === 'designer') {
      // Designers can access all BOQ data
      return await db.select().from(boq).where(eq(boq.projectVendorId, projectVendorId));
    } else {
      // Clients can only access BOQ for project vendors in their accessible projects
      const projectVendor = await db.select().from(projectVendors).where(eq(projectVendors.id, projectVendorId));
      if (projectVendor.length === 0) {
        return [];
      }
      
      const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
      if (!accessibleProjectIds.includes(projectVendor[0].projectId)) {
        return [];
      }
      
      return await db.select().from(boq).where(eq(boq.projectVendorId, projectVendorId));
    }
  }

  async getQuoteFilesForUser(userId: string, role: string, projectVendorId: string): Promise<QuoteFile[]> {
    if (role === 'designer') {
      // Designers can access all quote files
      return await db.select().from(quoteFiles).where(eq(quoteFiles.projectVendorId, projectVendorId));
    } else {
      // Clients can only access quote files for project vendors in their accessible projects
      const projectVendor = await db.select().from(projectVendors).where(eq(projectVendors.id, projectVendorId));
      if (projectVendor.length === 0) {
        return [];
      }
      
      const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
      if (!accessibleProjectIds.includes(projectVendor[0].projectId)) {
        return [];
      }
      
      return await db.select().from(quoteFiles).where(eq(quoteFiles.projectVendorId, projectVendorId));
    }
  }

  async getFloorPlansForUser(userId: string, role: string, projectId?: string): Promise<FloorPlan[]> {
    if (role === 'designer') {
      // Designers can access all floor plans
      if (projectId) {
        return await db.select().from(floorPlans).where(eq(floorPlans.projectId, projectId));
      }
      return await db.select().from(floorPlans);
    } else {
      // Clients can only access floor plans for their accessible projects
      const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
      if (accessibleProjectIds.length === 0) {
        return [];
      }
      
      if (projectId) {
        // Verify client has access to the specific project
        if (!accessibleProjectIds.includes(projectId)) {
          return [];
        }
        return await db.select().from(floorPlans).where(eq(floorPlans.projectId, projectId));
      }
      
      return await db.select().from(floorPlans).where(inArray(floorPlans.projectId, accessibleProjectIds));
    }
  }

  // Project Vendors
  async getAllProjectVendors(): Promise<ProjectVendor[]> {
    return await db.select().from(projectVendors);
  }

  async getProjectVendors(projectId: string): Promise<ProjectVendor[]> {
    return await db.select().from(projectVendors).where(eq(projectVendors.projectId, projectId));
  }

  async getProjectVendor(id: string): Promise<ProjectVendor | undefined> {
    const result = await db.select().from(projectVendors).where(eq(projectVendors.id, id));
    return result[0];
  }

  async createProjectVendor(projectVendor: InsertProjectVendor): Promise<ProjectVendor> {
    const result = await db.insert(projectVendors).values(projectVendor).returning();
    return result[0];
  }

  async upsertProjectVendor(projectVendor: InsertProjectVendor): Promise<ProjectVendor> {
    // Check if project-vendor relationship already exists
    const existing = await db.select().from(projectVendors)
      .where(
        and(
          eq(projectVendors.projectId, projectVendor.projectId),
          eq(projectVendors.vendorId, projectVendor.vendorId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      const result = await db.update(projectVendors)
        .set({
          ...projectVendor,
          quotationFile: projectVendor.quotationFile || existing[0].quotationFile,
          quotationValue: projectVendor.quotationValue || existing[0].quotationValue,
          dateOfQuotation: projectVendor.dateOfQuotation || existing[0].dateOfQuotation,
          notes: projectVendor.notes || existing[0].notes,
          templateId: projectVendor.templateId || existing[0].templateId,
          submittedAt: existing[0].submittedAt // Keep original submission time
        })
        .where(eq(projectVendors.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      // Create new record
      return await this.createProjectVendor(projectVendor);
    }
  }

  async updateProjectVendor(id: string, projectVendor: Partial<InsertProjectVendor>): Promise<ProjectVendor | undefined> {
    const result = await db.update(projectVendors).set(projectVendor).where(eq(projectVendors.id, id)).returning();
    return result[0];
  }

  async deleteProjectVendor(id: string): Promise<boolean> {
    const result = await db.delete(projectVendors).where(eq(projectVendors.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Quote Templates
  async getAllQuoteTemplates(): Promise<QuoteTemplate[]> {
    // Exclude originalFileData to avoid bloating API responses
    return await db.select({
      id: quoteTemplates.id,
      name: quoteTemplates.name,
      categoryId: quoteTemplates.categoryId,
      description: quoteTemplates.description,
      templateFile: quoteTemplates.templateFile,
      fields: quoteTemplates.fields,
      originalFileData: quoteTemplates.originalFileData,
      originalFileName: quoteTemplates.originalFileName,
      originalMimeType: quoteTemplates.originalMimeType,
      isActive: quoteTemplates.isActive,
      createdAt: quoteTemplates.createdAt
    }).from(quoteTemplates);
  }

  async getQuoteTemplate(id: string): Promise<QuoteTemplate | undefined> {
    // Exclude originalFileData to avoid bloating API responses
    const result = await db.select({
      id: quoteTemplates.id,
      name: quoteTemplates.name,
      categoryId: quoteTemplates.categoryId,
      description: quoteTemplates.description,
      templateFile: quoteTemplates.templateFile,
      fields: quoteTemplates.fields,
      originalFileData: quoteTemplates.originalFileData,
      originalFileName: quoteTemplates.originalFileName,
      originalMimeType: quoteTemplates.originalMimeType,
      isActive: quoteTemplates.isActive,
      createdAt: quoteTemplates.createdAt
    }).from(quoteTemplates).where(eq(quoteTemplates.id, id));
    return result[0];
  }

  async getQuoteTemplateWithFileData(id: string): Promise<QuoteTemplate | undefined> {
    // Include originalFileData for downloads
    const result = await db.select().from(quoteTemplates).where(eq(quoteTemplates.id, id));
    return result[0];
  }

  async getQuoteTemplatesByCategory(categoryId: string): Promise<QuoteTemplate[]> {
    // Exclude originalFileData to avoid bloating API responses
    return await db.select({
      id: quoteTemplates.id,
      name: quoteTemplates.name,
      categoryId: quoteTemplates.categoryId,
      description: quoteTemplates.description,
      templateFile: quoteTemplates.templateFile,
      fields: quoteTemplates.fields,
      originalFileData: quoteTemplates.originalFileData,
      originalFileName: quoteTemplates.originalFileName,
      originalMimeType: quoteTemplates.originalMimeType,
      isActive: quoteTemplates.isActive,
      createdAt: quoteTemplates.createdAt
    }).from(quoteTemplates).where(eq(quoteTemplates.categoryId, categoryId));
  }

  async createQuoteTemplate(template: InsertQuoteTemplate): Promise<QuoteTemplate> {
    const result = await db.insert(quoteTemplates).values(template).returning();
    return result[0];
  }

  async updateQuoteTemplate(id: string, template: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate | undefined> {
    const result = await db.update(quoteTemplates).set(template).where(eq(quoteTemplates.id, id)).returning();
    return result[0];
  }

  async deleteQuoteTemplate(id: string): Promise<boolean> {
    const result = await db.delete(quoteTemplates).where(eq(quoteTemplates.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // BOQ (Bill of Quantities)
  async getBOQByProjectVendor(projectVendorId: string): Promise<Boq[]> {
    return await db.select().from(boq).where(eq(boq.projectVendorId, projectVendorId));
  }

  async getBOQ(id: string): Promise<Boq | undefined> {
    const result = await db.select().from(boq).where(eq(boq.id, id));
    return result[0];
  }

  async createBOQ(boqItem: InsertBoq): Promise<Boq> {
    const result = await db.insert(boq).values(boqItem).returning();
    return result[0];
  }

  async updateBOQ(id: string, boqItem: Partial<InsertBoq>): Promise<Boq | undefined> {
    const result = await db.update(boq).set(boqItem).where(eq(boq.id, id)).returning();
    return result[0];
  }

  async deleteBOQ(id: string): Promise<boolean> {
    const result = await db.delete(boq).where(eq(boq.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async createBOQBatch(boqs: InsertBoq[]): Promise<Boq[]> {
    const result = await db.insert(boq).values(boqs).returning();
    return result;
  }

  async deleteBOQByProjectVendor(projectVendorId: string): Promise<boolean> {
    const result = await db.delete(boq).where(eq(boq.projectVendorId, projectVendorId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Quote Files
  async getQuoteFilesByProjectVendor(projectVendorId: string): Promise<QuoteFile[]> {
    return await db.select().from(quoteFiles).where(eq(quoteFiles.projectVendorId, projectVendorId));
  }

  async getQuoteFile(id: string): Promise<QuoteFile | undefined> {
    const result = await db.select().from(quoteFiles).where(eq(quoteFiles.id, id));
    return result[0];
  }

  async createQuoteFile(quoteFile: InsertQuoteFile): Promise<QuoteFile> {
    const result = await db.insert(quoteFiles).values(quoteFile).returning();
    return result[0];
  }

  async updateQuoteFile(id: string, updates: Partial<InsertQuoteFile>): Promise<QuoteFile | undefined> {
    const result = await db.update(quoteFiles).set(updates).where(eq(quoteFiles.id, id)).returning();
    return result[0];
  }

  async deleteQuoteFile(id: string): Promise<boolean> {
    const result = await db.delete(quoteFiles).where(eq(quoteFiles.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Floor Plans
  async getAllFloorPlans(): Promise<FloorPlan[]> {
    return await db.select().from(floorPlans);
  }

  async getFloorPlansByProject(projectId: string): Promise<FloorPlan[]> {
    return await db.select().from(floorPlans).where(eq(floorPlans.projectId, projectId));
  }

  async getFloorPlan(id: string): Promise<FloorPlan | undefined> {
    const result = await db.select().from(floorPlans).where(eq(floorPlans.id, id));
    return result[0];
  }

  async createFloorPlan(floorPlan: InsertFloorPlan): Promise<FloorPlan> {
    const result = await db.insert(floorPlans).values(floorPlan).returning();
    return result[0];
  }

  async updateFloorPlan(id: string, updates: Partial<InsertFloorPlan>): Promise<FloorPlan | undefined> {
    const result = await db.update(floorPlans).set(updates).where(eq(floorPlans.id, id)).returning();
    return result[0];
  }

  async deleteFloorPlan(id: string): Promise<boolean> {
    const result = await db.delete(floorPlans).where(eq(floorPlans.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const storage = new DBStorage();
