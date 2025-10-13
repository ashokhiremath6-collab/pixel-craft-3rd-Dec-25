import { 
  type User, 
  type UpsertUser,
  type UserRole,
  type InsertUserRole,
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
  type Moodboard,
  type InsertMoodboard,
  type ProjectSchedule,
  type InsertProjectSchedule,
  type Task,
  type InsertTask,
  type TaskDependency,
  type InsertTaskDependency,
  type TaskAlert,
  type InsertTaskAlert,
  type Approval,
  type InsertApproval,
  users,
  userRoles,
  designerAllowlist,
  vendorCategories,
  vendors,
  projects,
  projectVendors,
  quoteTemplates,
  boq,
  quoteFiles,
  floorPlans,
  moodboards,
  projectSchedules,
  tasks,
  taskDependencies,
  taskAlerts,
  approvals,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, inArray, isNull, and } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Users - Replit Auth required methods
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(userData: UpsertUser): Promise<User>;
  
  // User Project Access (for client role project assignment)
  createUserProjectAccess(access: { userId: string; projectId: string }): Promise<{ userId: string; projectId: string }>;
  deleteUserProjectAccess(userId: string, projectId: string): Promise<boolean>;
  
  // User Roles - for role-based access control
  getUserRole(userId: string): Promise<UserRole | undefined>;
  createUserRole(userRole: InsertUserRole): Promise<UserRole>;
  updateUserRole(userId: string, role: string): Promise<UserRole | undefined>;
  
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
  
  // Moodboards (also handles working drawings and renders via assetType)
  getAllMoodboards(assetType?: string): Promise<Moodboard[]>;
  getMoodboardsByProject(projectId: string, assetType?: string): Promise<Moodboard[]>;
  getGeneralMoodboards(assetType?: string): Promise<Moodboard[]>;
  getMoodboardsForUser(userId: string, role: string, projectId?: string, assetType?: string): Promise<Moodboard[]>;
  getMoodboard(id: string): Promise<Moodboard | undefined>;
  createMoodboard(moodboard: InsertMoodboard): Promise<Moodboard>;
  updateMoodboard(id: string, moodboard: Partial<InsertMoodboard>): Promise<Moodboard | undefined>;
  deleteMoodboard(id: string): Promise<boolean>;
  
  // Project Schedules
  getProjectSchedules(projectId: string): Promise<ProjectSchedule[]>;
  getProjectSchedule(id: string): Promise<ProjectSchedule | undefined>;
  createProjectSchedule(schedule: InsertProjectSchedule): Promise<ProjectSchedule>;
  updateProjectSchedule(id: string, schedule: Partial<InsertProjectSchedule>): Promise<ProjectSchedule | undefined>;
  deleteProjectSchedule(id: string): Promise<boolean>;
  
  // Task Management
  getTasksByProject(projectId: string): Promise<Task[]>;
  getTasksBySchedule(scheduleId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  
  // Task Dependencies
  getTaskDependencies(taskId: string): Promise<TaskDependency[]>;
  createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency>;
  deleteTaskDependency(id: string): Promise<boolean>;
  
  // Task Alerts
  getTaskAlertsByUser(userId: string): Promise<TaskAlert[]>;
  createTaskAlert(alert: InsertTaskAlert): Promise<TaskAlert>;
  markAlertAsRead(id: string): Promise<TaskAlert | undefined>;
  
  // Approvals
  getApprovalsByTask(taskId: string): Promise<Approval[]>;
  createApproval(approval: InsertApproval): Promise<Approval>;
  resolveApproval(id: string, status: string, comments?: string): Promise<Approval | undefined>;
  
  // Vendors (with role-based filtering)
  getVendorsForUser(userId: string, role: string): Promise<Vendor[]>;
  getProjectVendorsForUser(userId: string, role: string): Promise<ProjectVendor[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private userRoles: Map<string, UserRole>;
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
    this.userRoles = new Map();
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

  // User methods - Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id!);
    
    if (existingUser) {
      // Update existing user
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(existingUser.id, updatedUser);
      return updatedUser;
    } else {
      // Create new user
      const id = userData.id || randomUUID();
      const user: User = {
        id,
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(id, user);
      return user;
    }
  }

  // User Roles methods
  async getUserRole(userId: string): Promise<UserRole | undefined> {
    return Array.from(this.userRoles.values()).find(role => role.userId === userId && role.isActive);
  }

  async createUserRole(userRole: InsertUserRole): Promise<UserRole> {
    const id = randomUUID();
    const role: UserRole = {
      ...userRole,
      id,
      role: userRole.role || "client",
      isActive: userRole.isActive ?? true,
      assignedAt: new Date(),
    };
    this.userRoles.set(id, role);
    return role;
  }

  async updateUserRole(userId: string, newRole: string): Promise<UserRole | undefined> {
    const existingRole = await this.getUserRole(userId);
    if (existingRole) {
      existingRole.role = newRole;
      this.userRoles.set(existingRole.id, existingRole);
      return existingRole;
    }
    return undefined;
  }

  // User Project Access - simplified implementation using project.clientEmail
  async createUserProjectAccess(access: { userId: string; projectId: string }): Promise<{ userId: string; projectId: string }> {
    // For MemStorage, just return the access object (simplified)
    return access;
  }

  async deleteUserProjectAccess(userId: string, projectId: string): Promise<boolean> {
    // For MemStorage, just return true (simplified)
    return true;
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
    if (role === 'admin' || role === 'designer') {
      return Array.from(this.projects.values());
    }
    // For clients, filter by clientEmail matching user's email
    const user = await this.getUser(userId);
    if (!user?.email) return [];
    return Array.from(this.projects.values()).filter(p => p.clientEmail === user.email);
  }

  async getProjectVendorsForUser(userId: string, role: string, projectId?: string): Promise<ProjectVendor[]> {
    if (role === 'admin' || role === 'designer') {
      return projectId ? 
        Array.from(this.projectVendors.values()).filter(pv => pv.projectId === projectId) :
        Array.from(this.projectVendors.values());
    }
    // For clients, get accessible projects first
    const accessibleProjects = await this.getProjectsForUser(userId, role);
    const accessibleProjectIds = accessibleProjects.map(p => p.id);
    return Array.from(this.projectVendors.values()).filter(pv => 
      accessibleProjectIds.includes(pv.projectId) && (!projectId || pv.projectId === projectId)
    );
  }

  async getBOQForUser(userId: string, role: string, projectVendorId: string): Promise<Boq[]> {
    if (role === 'admin' || role === 'designer') {
      return Array.from(this.boq.values()).filter(b => b.projectVendorId === projectVendorId);
    }
    // Check if user has access to the project vendor's project
    const projectVendor = this.projectVendors.get(projectVendorId);
    if (!projectVendor) return [];
    const accessibleProjects = await this.getProjectsForUser(userId, role);
    const hasAccess = accessibleProjects.some(p => p.id === projectVendor.projectId);
    if (!hasAccess) return [];
    return Array.from(this.boq.values()).filter(b => b.projectVendorId === projectVendorId);
  }

  async getQuoteFilesForUser(userId: string, role: string, projectVendorId: string): Promise<QuoteFile[]> {
    if (role === 'admin' || role === 'designer') {
      return Array.from(this.quoteFiles.values()).filter(f => f.projectVendorId === projectVendorId);
    }
    // Check if user has access to the project vendor's project
    const projectVendor = this.projectVendors.get(projectVendorId);
    if (!projectVendor) return [];
    const accessibleProjects = await this.getProjectsForUser(userId, role);
    const hasAccess = accessibleProjects.some(p => p.id === projectVendor.projectId);
    if (!hasAccess) return [];
    return Array.from(this.quoteFiles.values()).filter(f => f.projectVendorId === projectVendorId);
  }

  async getFloorPlansForUser(userId: string, role: string, projectId?: string): Promise<FloorPlan[]> {
    if (role === 'admin' || role === 'designer') {
      return projectId ?
        Array.from(this.floorPlans.values()).filter(f => f.projectId === projectId) :
        Array.from(this.floorPlans.values());
    }
    const accessibleProjects = await this.getProjectsForUser(userId, role);
    const accessibleProjectIds = accessibleProjects.map(p => p.id);
    return Array.from(this.floorPlans.values()).filter(f => 
      accessibleProjectIds.includes(f.projectId) && (!projectId || f.projectId === projectId)
    );
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
    // Check if vendor has any quotations before deleting
    const hasQuotations = Array.from(this.projectVendors.values()).some(pv => pv.vendorId === id);
    
    if (hasQuotations) {
      throw new Error("Cannot delete vendor with existing quotations. Please remove all quotes first.");
    }
    
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
      quotationName: insertProjectVendor.quotationName || "Main Quote",
      quotationType: insertProjectVendor.quotationType || "item",
      parentQuotationId: insertProjectVendor.parentQuotationId || null,
      itemCategory: insertProjectVendor.itemCategory || null,
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
    // Check if specific quotation already exists (project + vendor + quotation name)
    const existingProjectVendor = Array.from(this.projectVendors.values()).find(
      pv => pv.projectId === insertProjectVendor.projectId && 
            pv.vendorId === insertProjectVendor.vendorId &&
            pv.quotationName === (insertProjectVendor.quotationName || 'Main Quote')
    );

    if (existingProjectVendor) {
      // Update existing record
      const updated = { 
        ...existingProjectVendor, 
        ...insertProjectVendor,
        quotationName: insertProjectVendor.quotationName || existingProjectVendor.quotationName,
        quotationType: insertProjectVendor.quotationType || existingProjectVendor.quotationType,
        parentQuotationId: insertProjectVendor.parentQuotationId || existingProjectVendor.parentQuotationId,
        itemCategory: insertProjectVendor.itemCategory || existingProjectVendor.itemCategory,
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
      // Create new record (allows multiple quotations per vendor per project)
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

  // Moodboards (stubs for MemStorage - not used in production)
  async getAllMoodboards(assetType?: string): Promise<Moodboard[]> {
    return [];
  }

  async getMoodboardsByProject(projectId: string, assetType?: string): Promise<Moodboard[]> {
    return [];
  }

  async getGeneralMoodboards(assetType?: string): Promise<Moodboard[]> {
    return [];
  }

  async getMoodboardsForUser(userId: string, role: string, projectId?: string, assetType?: string): Promise<Moodboard[]> {
    return [];
  }

  async getMoodboard(id: string): Promise<Moodboard | undefined> {
    return undefined;
  }

  async createMoodboard(moodboard: InsertMoodboard): Promise<Moodboard> {
    throw new Error("MemStorage not supported for moodboards");
  }

  async updateMoodboard(id: string, moodboard: Partial<InsertMoodboard>): Promise<Moodboard | undefined> {
    return undefined;
  }

  async deleteMoodboard(id: string): Promise<boolean> {
    return false;
  }

  // Task Management (stubs for MemStorage - not used in production)
  async getTasksByProject(projectId: string): Promise<Task[]> {
    return [];
  }

  async getTasksBySchedule(scheduleId: string): Promise<Task[]> {
    return [];
  }

  async getTask(id: string): Promise<Task | undefined> {
    return undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    throw new Error("MemStorage not supported for tasks");
  }

  async updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined> {
    return undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    return false;
  }

  async getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
    return [];
  }

  async createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency> {
    throw new Error("MemStorage not supported for task dependencies");
  }

  async deleteTaskDependency(id: string): Promise<boolean> {
    return false;
  }

  async getTaskAlertsByUser(userId: string): Promise<TaskAlert[]> {
    return [];
  }

  async createTaskAlert(alert: InsertTaskAlert): Promise<TaskAlert> {
    throw new Error("MemStorage not supported for task alerts");
  }

  async markAlertAsRead(id: string): Promise<TaskAlert | undefined> {
    return undefined;
  }

  async getApprovalsByTask(taskId: string): Promise<Approval[]> {
    return [];
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    throw new Error("MemStorage not supported for approvals");
  }

  async resolveApproval(id: string, status: string, comments?: string): Promise<Approval | undefined> {
    return undefined;
  }

  async getVendorsForUser(userId: string, role: string): Promise<Vendor[]> {
    if (role === 'designer' || role === 'admin') {
      return this.getAllVendors();
    }
    return [];
  }

  async getProjectVendorsForUser(userId: string, role: string): Promise<ProjectVendor[]> {
    if (role === 'designer' || role === 'admin') {
      return Array.from(this.projectVendors.values());
    }
    return [];
  }
}

export class DBStorage implements IStorage {
  // Users - Replit Auth required methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // User Roles methods
  async getUserRole(userId: string): Promise<UserRole | undefined> {
    const result = await db.select().from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)));
    return result[0];
  }

  async createUserRole(userRole: InsertUserRole): Promise<UserRole> {
    const result = await db.insert(userRoles).values(userRole).returning();
    return result[0];
  }

  async updateUserRole(userId: string, newRole: string): Promise<UserRole | undefined> {
    const result = await db.update(userRoles)
      .set({ role: newRole })
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)))
      .returning();
    return result[0];
  }

  // User Project Access - simplified implementation using existing project access control
  async createUserProjectAccess(access: { userId: string; projectId: string }): Promise<{ userId: string; projectId: string }> {
    // For this simple implementation, we'll just return the access object
    // In a full implementation, this would create a user_project_access table entry
    return access;
  }

  async deleteUserProjectAccess(userId: string, projectId: string): Promise<boolean> {
    // For this simple implementation, we'll just return true
    // In a full implementation, this would delete from user_project_access table
    return true;
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
  // Private helper to get accessible project IDs for a user
  private async getUserAccessibleProjects(userId: string): Promise<string[]> {
    const user = await this.getUser(userId);
    if (!user?.email) return [];
    
    // Get projects where user's email matches clientEmail
    const userProjects = await db.select({ id: projects.id })
      .from(projects)
      .where(eq(projects.clientEmail, user.email));
    
    return userProjects.map(p => p.id);
  }

  async getProjectsForUser(userId: string, role: string): Promise<Project[]> {
    // ALL authenticated users (designers, admins, and clients) can access all projects
    return await db.select().from(projects);
  }

  async getProjectVendorsForUser(userId: string, role: string, projectId?: string): Promise<ProjectVendor[]> {
    // ALL authenticated users (designers, admins, and clients) can access all project vendors/quotations
    if (projectId) {
      return await db.select().from(projectVendors).where(eq(projectVendors.projectId, projectId));
    }
    return await db.select().from(projectVendors);
  }

  async getBOQForUser(userId: string, role: string, projectVendorId: string): Promise<Boq[]> {
    if (role === 'designer' || role === 'admin') {
      // Designers and admins can access all BOQ data
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
    if (role === 'designer' || role === 'admin') {
      // Designers and admins can access all quote files
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
    // ALL authenticated users (designers, admins, and clients) can access all floor plans
    if (projectId) {
      return await db.select().from(floorPlans).where(eq(floorPlans.projectId, projectId));
    }
    return await db.select().from(floorPlans);
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
    // Check if specific quotation already exists (project + vendor + quotation name)
    const existing = await db.select().from(projectVendors)
      .where(
        and(
          eq(projectVendors.projectId, projectVendor.projectId),
          eq(projectVendors.vendorId, projectVendor.vendorId),
          eq(projectVendors.quotationName, projectVendor.quotationName || 'Main Quote')
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
      // Create new record (allows multiple quotations per vendor per project)
      return await this.createProjectVendor(projectVendor);
    }
  }

  async updateProjectVendor(id: string, projectVendor: Partial<InsertProjectVendor>): Promise<ProjectVendor | undefined> {
    const result = await db.update(projectVendors).set(projectVendor).where(eq(projectVendors.id, id)).returning();
    return result[0];
  }

  async deleteProjectVendor(id: string): Promise<boolean> {
    // Use a transaction to ensure atomic cascading deletes
    return await db.transaction(async (tx) => {
      // Helper function to recursively delete within the transaction
      const deleteWithinTransaction = async (deleteId: string) => {
        // First, find and delete any child quotes (options) that reference this quote as parent
        const childQuotes = await tx.select().from(projectVendors)
          .where(eq(projectVendors.parentQuotationId, deleteId));
        
        for (const child of childQuotes) {
          // Recursively delete child quotes and their dependencies
          await deleteWithinTransaction(child.id);
        }
        
        // Delete all BOQ entries that reference this project vendor
        await tx.delete(boq).where(eq(boq.projectVendorId, deleteId));
        
        // Delete all quote files that reference this project vendor
        await tx.delete(quoteFiles).where(eq(quoteFiles.projectVendorId, deleteId));
        
        // Finally delete the project vendor itself
        const result = await tx.delete(projectVendors).where(eq(projectVendors.id, deleteId));
        return result.rowCount !== null && result.rowCount > 0;
      };
      
      return await deleteWithinTransaction(id);
    });
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

  // Moodboards
  async getAllMoodboards(assetType?: string): Promise<Moodboard[]> {
    if (assetType) {
      return await db.select().from(moodboards).where(eq(moodboards.assetType, assetType)).orderBy(moodboards.uploadedAt);
    }
    return await db.select().from(moodboards).orderBy(moodboards.uploadedAt);
  }

  async getMoodboardsByProject(projectId: string, assetType?: string): Promise<Moodboard[]> {
    const conditions = [eq(moodboards.projectId, projectId)];
    if (assetType) {
      conditions.push(eq(moodboards.assetType, assetType));
    }
    return await db.select().from(moodboards).where(and(...conditions)).orderBy(moodboards.uploadedAt);
  }

  async getGeneralMoodboards(assetType?: string): Promise<Moodboard[]> {
    const conditions = [isNull(moodboards.projectId)];
    if (assetType) {
      conditions.push(eq(moodboards.assetType, assetType));
    }
    return await db.select().from(moodboards).where(and(...conditions)).orderBy(moodboards.uploadedAt);
  }

  async getMoodboard(id: string): Promise<Moodboard | undefined> {
    const result = await db.select().from(moodboards).where(eq(moodboards.id, id));
    return result[0];
  }

  async createMoodboard(moodboard: InsertMoodboard): Promise<Moodboard> {
    const result = await db.insert(moodboards).values(moodboard).returning();
    return result[0];
  }

  async updateMoodboard(id: string, updates: Partial<InsertMoodboard>): Promise<Moodboard | undefined> {
    const result = await db.update(moodboards).set(updates).where(eq(moodboards.id, id)).returning();
    return result[0];
  }

  async deleteMoodboard(id: string): Promise<boolean> {
    const result = await db.delete(moodboards).where(eq(moodboards.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getMoodboardsForUser(userId: string, role: string, projectId?: string, assetType?: string): Promise<Moodboard[]> {
    if (role === 'designer' || role === 'admin') {
      // Designers and admins can access all moodboards
      const conditions = [];
      if (projectId && projectId !== 'general') {
        conditions.push(eq(moodboards.projectId, projectId));
      } else if (projectId === 'general') {
        conditions.push(isNull(moodboards.projectId));
      }
      if (assetType) {
        conditions.push(eq(moodboards.assetType, assetType));
      }
      
      if (conditions.length > 0) {
        return await db.select().from(moodboards).where(and(...conditions)).orderBy(moodboards.uploadedAt);
      }
      return await db.select().from(moodboards).orderBy(moodboards.uploadedAt);
    } else {
      // Clients can only access moodboards for their accessible projects
      const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
      if (accessibleProjectIds.length === 0) {
        return [];
      }
      
      const conditions = [inArray(moodboards.projectId, accessibleProjectIds)];
      if (projectId && projectId !== 'general') {
        // Verify client has access to the specific project
        if (!accessibleProjectIds.includes(projectId)) {
          return [];
        }
        conditions.push(eq(moodboards.projectId, projectId));
      }
      if (assetType) {
        conditions.push(eq(moodboards.assetType, assetType));
      }
      
      return await db.select().from(moodboards).where(and(...conditions)).orderBy(moodboards.uploadedAt);
    }
  }

  async getVendorsForUser(userId: string, role: string): Promise<Vendor[]> {
    if (role === 'designer' || role === 'admin') {
      // Designers and admins can access all vendors
      return await db.select().from(vendors);
    } else {
      // Clients can only access vendors associated with their projects
      const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
      if (accessibleProjectIds.length === 0) {
        return [];
      }
      
      // Get vendors that are associated with the client's projects through project_vendors
      const vendorIds = await db
        .selectDistinct({ vendorId: projectVendors.vendorId })
        .from(projectVendors)
        .where(inArray(projectVendors.projectId, accessibleProjectIds));
      
      if (vendorIds.length === 0) {
        return [];
      }
      
      return await db.select().from(vendors).where(inArray(vendors.id, vendorIds.map(v => v.vendorId)));
    }
  }

  async getProjectVendorsForUser(userId: string, role: string): Promise<ProjectVendor[]> {
    if (role === 'designer' || role === 'admin') {
      // Designers and admins can access all project vendors
      return await db.select().from(projectVendors);
    } else {
      // Clients can only access project vendors for their accessible projects
      const accessibleProjectIds = await this.getUserAccessibleProjects(userId);
      if (accessibleProjectIds.length === 0) {
        return [];
      }
      
      return await db.select().from(projectVendors).where(inArray(projectVendors.projectId, accessibleProjectIds));
    }
  }

  // Project Schedules
  async getProjectSchedules(projectId: string): Promise<ProjectSchedule[]> {
    return await db.select().from(projectSchedules).where(eq(projectSchedules.projectId, projectId)).orderBy(projectSchedules.uploadedAt);
  }

  async getProjectSchedule(id: string): Promise<ProjectSchedule | undefined> {
    const result = await db.select().from(projectSchedules).where(eq(projectSchedules.id, id));
    return result[0];
  }

  async createProjectSchedule(schedule: InsertProjectSchedule): Promise<ProjectSchedule> {
    const result = await db.insert(projectSchedules).values(schedule).returning();
    return result[0];
  }

  async updateProjectSchedule(id: string, updates: Partial<InsertProjectSchedule>): Promise<ProjectSchedule | undefined> {
    const result = await db.update(projectSchedules).set(updates).where(eq(projectSchedules.id, id)).returning();
    return result[0];
  }

  async deleteProjectSchedule(id: string): Promise<boolean> {
    const result = await db.delete(projectSchedules).where(eq(projectSchedules.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Task Management
  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(tasks.startDate);
  }

  async getTasksBySchedule(scheduleId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.scheduleId, scheduleId)).orderBy(tasks.startDate);
  }

  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const result = await db.update(tasks).set({ ...updates, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Task Dependencies
  async getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
    return await db.select().from(taskDependencies).where(eq(taskDependencies.toTaskId, taskId));
  }

  async createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency> {
    const result = await db.insert(taskDependencies).values(dependency).returning();
    return result[0];
  }

  async deleteTaskDependency(id: string): Promise<boolean> {
    const result = await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Task Alerts
  async getTaskAlertsByUser(userId: string): Promise<TaskAlert[]> {
    return await db.select().from(taskAlerts).where(eq(taskAlerts.userId, userId)).orderBy(taskAlerts.triggeredAt);
  }

  async createTaskAlert(alert: InsertTaskAlert): Promise<TaskAlert> {
    const result = await db.insert(taskAlerts).values(alert).returning();
    return result[0];
  }

  async markAlertAsRead(id: string): Promise<TaskAlert | undefined> {
    const result = await db.update(taskAlerts).set({ isRead: true }).where(eq(taskAlerts.id, id)).returning();
    return result[0];
  }

  // Approvals
  async getApprovalsByTask(taskId: string): Promise<Approval[]> {
    return await db.select().from(approvals).where(eq(approvals.taskId, taskId)).orderBy(approvals.createdAt);
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    const result = await db.insert(approvals).values(approval).returning();
    return result[0];
  }

  async resolveApproval(id: string, status: string, comments?: string): Promise<Approval | undefined> {
    const updates: any = { status, resolvedAt: new Date() };
    if (comments) updates.comments = comments;
    const result = await db.update(approvals).set(updates).where(eq(approvals.id, id)).returning();
    return result[0];
  }
}

export const storage = new DBStorage();
