import { 
  type User, 
  type InsertUser,
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
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  getProjectVendors(projectId: string): Promise<ProjectVendor[]>;
  getProjectVendor(id: string): Promise<ProjectVendor | undefined>;
  createProjectVendor(projectVendor: InsertProjectVendor): Promise<ProjectVendor>;
  updateProjectVendor(id: string, projectVendor: Partial<InsertProjectVendor>): Promise<ProjectVendor | undefined>;
  deleteProjectVendor(id: string): Promise<boolean>;
  
  // Quote Templates
  getAllQuoteTemplates(): Promise<QuoteTemplate[]>;
  getQuoteTemplate(id: string): Promise<QuoteTemplate | undefined>;
  getQuoteTemplatesByCategory(categoryId: string): Promise<QuoteTemplate[]>;
  createQuoteTemplate(template: InsertQuoteTemplate): Promise<QuoteTemplate>;
  updateQuoteTemplate(id: string, template: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate | undefined>;
  deleteQuoteTemplate(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private vendorCategories: Map<string, VendorCategory>;
  private vendors: Map<string, Vendor>;
  private projects: Map<string, Project>;
  private projectVendors: Map<string, ProjectVendor>;
  private quoteTemplates: Map<string, QuoteTemplate>;

  constructor() {
    this.users = new Map();
    this.vendorCategories = new Map();
    this.vendors = new Map();
    this.projects = new Map();
    this.projectVendors = new Map();
    this.quoteTemplates = new Map();
    
    // Initialize with predefined categories
    this.initializePredefinedCategories();
  }

  private initializePredefinedCategories() {
    const predefinedCategories = [
      { name: "Civil", description: "Civil construction and structural work" },
      { name: "Electrical", description: "Electrical installations and systems" },
      { name: "Plumbing", description: "Plumbing and water systems" },
      { name: "HVAC", description: "Heating, ventilation, and air conditioning" },
      { name: "Kitchen", description: "Kitchen fixtures and appliances" },
      { name: "Flooring", description: "Floor installations and materials" },
      { name: "Windows", description: "Windows and glazing systems" },
      { name: "Carpentry", description: "Carpentry and woodwork" },
      { name: "Audio Systems", description: "Audio and sound systems" },
      { name: "Automation", description: "Home and building automation" },
      { name: "Furniture", description: "Furniture and furnishings" },
      { name: "Soft Furnishings", description: "Curtains, upholstery, and soft furnishings" },
      { name: "Wall Finishes", description: "Paint, wallpaper, and wall treatments" },
      { name: "Appliances", description: "Home and commercial appliances" },
      { name: "Bathroom Fittings", description: "Bathroom fixtures and fittings" },
    ];

    // Create main categories only - users can create their own subcategories
    predefinedCategories.forEach(category => {
      const id = randomUUID();
      const vendorCategory: VendorCategory = {
        id,
        name: category.name,
        parentId: null,
        description: category.description,
        isActive: true,
      };
      this.vendorCategories.set(id, vendorCategory);
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
    const findChildren = (parentId: string): void => {
      const children = Array.from(this.vendorCategories.values())
        .filter(cat => cat.parentId === parentId);
      
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

  // Project Vendor methods
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
      status: insertProjectVendor.status || "Quoted",
      notes: insertProjectVendor.notes || null,
      quotationFile: insertProjectVendor.quotationFile || null,
      quotationValue: insertProjectVendor.quotationValue || null,
      dateOfQuotation: insertProjectVendor.dateOfQuotation || null,
      templateId: insertProjectVendor.templateId || null,
      submittedAt: new Date()
    };
    this.projectVendors.set(id, projectVendor);
    return projectVendor;
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

  // Quote Template methods
  async getAllQuoteTemplates(): Promise<QuoteTemplate[]> {
    return Array.from(this.quoteTemplates.values());
  }

  async getQuoteTemplate(id: string): Promise<QuoteTemplate | undefined> {
    return this.quoteTemplates.get(id);
  }

  async getQuoteTemplatesByCategory(categoryId: string): Promise<QuoteTemplate[]> {
    return Array.from(this.quoteTemplates.values()).filter(
      template => template.categoryId === categoryId
    );
  }

  async createQuoteTemplate(insertTemplate: InsertQuoteTemplate): Promise<QuoteTemplate> {
    const id = randomUUID();
    const template: QuoteTemplate = { 
      ...insertTemplate, 
      id,
      description: insertTemplate.description || null,
      templateFile: insertTemplate.templateFile || null,
      fields: insertTemplate.fields || null,
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
}

export const storage = new MemStorage();
