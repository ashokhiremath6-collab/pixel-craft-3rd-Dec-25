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
  getAllProjectVendors(): Promise<ProjectVendor[]>;
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private vendorCategories: Map<string, VendorCategory>;
  private vendors: Map<string, Vendor>;
  private projects: Map<string, Project>;
  private projectVendors: Map<string, ProjectVendor>;
  private quoteTemplates: Map<string, QuoteTemplate>;
  private boq: Map<string, Boq>;
  private quoteFiles: Map<string, QuoteFile>;

  constructor() {
    this.users = new Map();
    this.vendorCategories = new Map();
    this.vendors = new Map();
    this.projects = new Map();
    this.projectVendors = new Map();
    this.quoteTemplates = new Map();
    this.boq = new Map();
    this.quoteFiles = new Map();
    
    // Initialize with predefined categories
    this.initializePredefinedCategories();
    
    // Initialize with sample data for testing
    this.initializeSampleData();
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

  private initializeSampleData() {
    // Sample Projects
    const sampleProjects = [
      {
        id: randomUUID(),
        projectName: "City Center Mall Renovation",
        clientName: "Metro Development Corp",
        startDate: "2024-01-15",
        endDate: "2024-06-30"
      },
      {
        id: randomUUID(),
        projectName: "Hospital Wing Construction",
        clientName: "Regional Medical Center", 
        startDate: "2024-03-01",
        endDate: null
      },
      {
        id: randomUUID(),
        projectName: "Office Complex Expansion",
        clientName: "TechCorp Industries",
        startDate: "2024-02-01",
        endDate: "2024-08-15"
      },
      {
        id: randomUUID(),
        projectName: "Residential Tower Development",
        clientName: "Skyline Properties",
        startDate: "2024-04-01",
        endDate: "2024-12-31"
      }
    ];

    sampleProjects.forEach(project => {
      this.projects.set(project.id, project);
    });

    // Get some category IDs for vendors
    const categories = Array.from(this.vendorCategories.values());
    const civilCat = categories.find(cat => cat.name === "Civil");
    const electricalCat = categories.find(cat => cat.name === "Electrical");
    const plumbingCat = categories.find(cat => cat.name === "Plumbing");

    // Sample Vendors
    const sampleVendors = [
      {
        id: randomUUID(),
        name: "ABC Construction Ltd",
        categoryId: civilCat?.id || categories[0]?.id || "category-1",
        contactPerson: "John Smith",
        phone: "+91-9876543210",
        email: "john@abcconstruction.com",
        notes: "Specializes in commercial construction"
      },
      {
        id: randomUUID(),
        name: "ElectroTech Solutions",
        categoryId: electricalCat?.id || categories[1]?.id || "category-2",
        contactPerson: "Sarah Wilson",
        phone: "+91-9876543211",
        email: "sarah@electrotech.com",
        notes: "Expert in industrial electrical systems"
      },
      {
        id: randomUUID(),
        name: "BuildRight Corp",
        categoryId: civilCat?.id || categories[0]?.id || "category-1",
        contactPerson: "Mike Johnson",
        phone: "+91-9876543212",
        email: "mike@buildright.com",
        notes: "Residential and commercial construction"
      },
      {
        id: randomUUID(),
        name: "PowerPro Electric",
        categoryId: electricalCat?.id || categories[1]?.id || "category-2",
        contactPerson: "Lisa Chen",
        phone: "+91-9876543213",
        email: "lisa@powerpro.com",
        notes: "Electrical installations and maintenance"
      },
      {
        id: randomUUID(),
        name: "AquaFlow Plumbing",
        categoryId: plumbingCat?.id || categories[2]?.id || "category-3",
        contactPerson: "David Brown",
        phone: "+91-9876543214",
        email: "david@aquaflow.com",
        notes: "Complete plumbing solutions"
      }
    ];

    sampleVendors.forEach(vendor => {
      this.vendors.set(vendor.id, vendor);
    });

    // Create sample project-vendor relationships with quotations
    const projectArray = Array.from(this.projects.values());
    const vendorArray = Array.from(this.vendors.values());

    if (projectArray.length > 0 && vendorArray.length > 0) {
      const project1 = projectArray[0]; // City Center Mall Renovation
      const project2 = projectArray[1]; // Hospital Wing Construction

      // Sample project-vendor relationships with hardcoded IDs to match frontend mock data
      const sampleProjectVendors = [
        {
          id: "1", // ABC Construction - matches frontend mock ID
          projectId: project1.id,
          vendorId: vendorArray[0].id, // ABC Construction Ltd
          quotationValue: "4500000.00",
          dateOfQuotation: "2024-01-20",
          status: "Selected" as const,
          notes: "Selected based on competitive pricing and quality track record"
        },
        {
          id: "2", // BuildRight Corp - matches frontend mock ID
          projectId: project1.id,
          vendorId: vendorArray[2].id, // BuildRight Corp
          quotationValue: "5200000.00",
          dateOfQuotation: "2024-01-16",
          status: "Quoted" as const,
          notes: "Comprehensive quote with detailed BOQ"
        },
        {
          id: "3", // ElectroTech Solutions - matches frontend mock ID
          projectId: project1.id,
          vendorId: vendorArray[1].id, // ElectroTech Solutions
          quotationValue: "7500000.00",
          dateOfQuotation: "2024-01-18",
          status: "Quoted" as const,
          notes: "Electrical systems installation"
        },
        {
          id: "4", // PowerPro Electric - matches frontend mock ID
          projectId: project2.id,
          vendorId: vendorArray[3].id, // PowerPro Electric
          quotationValue: "3375000.00",
          dateOfQuotation: "2024-01-22",
          status: "Quoted" as const,
          notes: "Hospital electrical infrastructure"
        }
      ];

      sampleProjectVendors.forEach(pv => {
        this.projectVendors.set(pv.id, {
          ...pv,
          quotationFile: null,
          templateId: null,
          submittedAt: new Date()
        });
      });

      // Sample BOQ data for the project-vendor relationships
      const sampleBoqItems = [
        // BOQ for ABC Construction Ltd - Civil work
        {
          projectVendorId: sampleProjectVendors[0].id,
          itemDescription: "Concrete Foundation Work",
          quantity: "250.00",
          unit: "m³",
          unitRate: "8500.00",
          totalAmount: "2125000.00",
          category: "Civil Work",
          itemCode: "CIV-001",
          specifications: "M25 grade concrete with reinforcement as per IS 456"
        },
        {
          projectVendorId: sampleProjectVendors[0].id,
          itemDescription: "Brick Masonry Work",
          quantity: "500.00",
          unit: "m²",
          unitRate: "1200.00",
          totalAmount: "600000.00",
          category: "Civil Work",
          itemCode: "CIV-002",
          specifications: "Standard brick masonry with cement mortar 1:6"
        },
        {
          projectVendorId: sampleProjectVendors[0].id,
          itemDescription: "Steel Reinforcement",
          quantity: "25.00",
          unit: "MT",
          unitRate: "75000.00",
          totalAmount: "1875000.00",
          category: "Material",
          itemCode: "MAT-001",
          specifications: "TMT bars Fe 415 grade as per IS 1786"
        },

        // BOQ for BuildRight Corp
        {
          projectVendorId: sampleProjectVendors[1].id,
          itemDescription: "Excavation Work",
          quantity: "400.00",
          unit: "m³",
          unitRate: "850.00",
          totalAmount: "340000.00",
          category: "Earthwork",
          itemCode: "EW-001",
          specifications: "Machine excavation up to 3m depth"
        },
        {
          projectVendorId: sampleProjectVendors[1].id,
          itemDescription: "Structural Steel Work",
          quantity: "15.00",
          unit: "MT",
          unitRate: "85000.00",
          totalAmount: "1275000.00",
          category: "Structural",
          itemCode: "STR-001",
          specifications: "Structural steel work including fabrication and erection"
        },
        {
          projectVendorId: sampleProjectVendors[1].id,
          itemDescription: "Concrete Flooring",
          quantity: "800.00",
          unit: "m²",
          unitRate: "2200.00",
          totalAmount: "1760000.00",
          category: "Civil Work",
          itemCode: "CIV-003",
          specifications: "RCC slab 150mm thick with waterproofing"
        },
        {
          projectVendorId: sampleProjectVendors[1].id,
          itemDescription: "Plastering Work",
          quantity: "1200.00",
          unit: "m²",
          unitRate: "350.00",
          totalAmount: "420000.00",
          category: "Finishing",
          itemCode: "FIN-001",
          specifications: "Internal plastering 12mm thick with cement mortar"
        },

        // BOQ for ElectroTech Solutions - Electrical work
        {
          projectVendorId: sampleProjectVendors[2].id,
          itemDescription: "Main Distribution Panel",
          quantity: "1.00",
          unit: "No",
          unitRate: "450000.00",
          totalAmount: "450000.00",
          category: "Electrical Equipment",
          itemCode: "ELE-001",
          specifications: "1600A main distribution panel with MCCB and accessories"
        },
        {
          projectVendorId: sampleProjectVendors[2].id,
          itemDescription: "Electrical Wiring",
          quantity: "2500.00",
          unit: "m",
          unitRate: "850.00",
          totalAmount: "2125000.00",
          category: "Electrical Installation",
          itemCode: "ELE-002",
          specifications: "Copper conductor wiring in PVC conduits"
        },
        {
          projectVendorId: sampleProjectVendors[2].id,
          itemDescription: "LED Lighting Fixtures",
          quantity: "150.00",
          unit: "No",
          unitRate: "2800.00",
          totalAmount: "420000.00",
          category: "Lighting",
          itemCode: "ELE-003",
          specifications: "36W LED panel lights with driver and mounting accessories"
        },
        {
          projectVendorId: sampleProjectVendors[2].id,
          itemDescription: "Emergency Generator Setup",
          quantity: "1.00",
          unit: "Set",
          unitRate: "4500000.00",
          totalAmount: "4500000.00",
          category: "Power Systems",
          itemCode: "ELE-004",
          specifications: "500KVA diesel generator with AMF panel and accessories"
        },

        // BOQ for PowerPro Electric - Hospital electrical
        {
          projectVendorId: sampleProjectVendors[3].id,
          itemDescription: "Hospital Grade Electrical Panels",
          quantity: "3.00",
          unit: "No",
          unitRate: "285000.00",
          totalAmount: "855000.00",
          category: "Medical Equipment",
          itemCode: "MED-001",
          specifications: "Hospital grade distribution panels with isolated ground"
        },
        {
          projectVendorId: sampleProjectVendors[3].id,
          itemDescription: "Nurse Call System",
          quantity: "50.00",
          unit: "Points",
          unitRate: "15000.00",
          totalAmount: "750000.00",
          category: "Communication",
          itemCode: "COM-001",
          specifications: "Wireless nurse call system with bedside and bathroom stations"
        },
        {
          projectVendorId: sampleProjectVendors[3].id,
          itemDescription: "UPS System Installation",
          quantity: "1.00",
          unit: "Set",
          unitRate: "1770000.00",
          totalAmount: "1770000.00",
          category: "Power Backup",
          itemCode: "PWR-001",
          specifications: "100KVA online UPS with battery bank for critical loads"
        }
      ];

      // Create BOQ items
      sampleBoqItems.forEach(boqData => {
        const id = randomUUID();
        const boq = {
          ...boqData,
          id,
          quantity: boqData.quantity,
          unitRate: boqData.unitRate,
          totalAmount: boqData.totalAmount
        };
        this.boq.set(id, boq);
      });
    }
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

  // BOQ (Bill of Quantities) methods
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
    for (const boq of boqItems) {
      if (this.boq.delete(boq.id)) {
        deletedCount++;
      }
    }
    
    return deletedCount > 0;
  }

  // Quote Files methods
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
}

export const storage = new MemStorage();
