import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, date, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Vendor Categories table - hierarchical structure
export const vendorCategories = pgTable("vendor_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  parentId: varchar("parent_id"), // null for main categories, references parent category
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

// Vendors table
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  categoryId: varchar("category_id").notNull().references(() => vendorCategories.id),
  contactPerson: text("contact_person").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  notes: text("notes"),
});

// Projects table  
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectName: text("project_name").notNull(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(), // Email for client access control
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
});

// Quote Templates table
export const quoteTemplates = pgTable("quote_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  categoryId: varchar("category_id").notNull().references(() => vendorCategories.id),
  description: text("description"),
  templateFile: text("template_file"), // file path/url in storage
  fields: jsonb("fields"), // JSON structure of required fields
  originalFileData: text("original_file_data"), // Base64 encoded original Excel file
  originalFileName: text("original_file_name"), // Original file name for download
  originalMimeType: text("original_mime_type"), // Original MIME type for download
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Project-Vendor junction table with enhanced quotation support
export const projectVendors = pgTable("project_vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  quotationName: text("quotation_name").notNull().default("Main Quote"), // "Option A", "Kitchen Cabinets", etc.
  quotationType: text("quotation_type").notNull().default("item"), // "item" or "option"
  parentQuotationId: varchar("parent_quotation_id"), // Self-reference for grouping options - added later
  itemCategory: text("item_category"), // For folder organization
  quotationFile: text("quotation_file"), // file path/url
  quotationValue: decimal("quotation_value", { precision: 10, scale: 2 }),
  dateOfQuotation: date("date_of_quotation"),
  status: text("status").notNull().default("Quoted"), // Quoted, Selected, Rejected
  notes: text("notes"),
  templateId: varchar("template_id").references(() => quoteTemplates.id),
  submittedAt: timestamp("submitted_at").default(sql`now()`),
});

// BOQ (Bill of Quantities) table
export const boq = pgTable("boq", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectVendorId: varchar("project_vendor_id").notNull().references(() => projectVendors.id),
  itemDescription: text("item_description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(), // m², kg, pieces, etc.
  unitRate: decimal("unit_rate", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category"), // labor, material, equipment, etc.
  itemCode: text("item_code"),
  specifications: text("specifications"),
});

// Quote Files table for multiple file support
export const quoteFiles = pgTable("quote_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectVendorId: varchar("project_vendor_id").notNull().references(() => projectVendors.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // path in object storage
  fileType: text("file_type").notNull(), // pdf, xlsx, doc, etc.
  fileSize: decimal("file_size"), // in bytes
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
  externalStorageProvider: text("external_storage_provider"), // dropbox, onedrive, etc.
  externalFileId: text("external_file_id"), // ID in external storage system
});

// Floor Plans table
export const floorPlans = pgTable("floor_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // path in object storage
  fileType: text("file_type").notNull(), // pdf, dwg, png, jpg, etc.
  fileSize: decimal("file_size"), // in bytes
  version: text("version").notNull().default("1.0"),
  isActive: boolean("is_active").notNull().default(true),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
});

// Moodboards table
export const moodboards = pgTable("moodboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id), // Optional - can be null for general moodboards
  name: text("name").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // path in object storage
  fileType: text("file_type").notNull(), // jpeg, png, svg, webp, pdf, etc.
  fileSize: decimal("file_size"), // in bytes
  tags: jsonb("tags"), // Array of tags for organization
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
});

// Insert schemas
export const insertVendorCategorySchema = createInsertSchema(vendorCategories).omit({
  id: true,
});

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
}).extend({
  clientEmail: z.string().email("Please enter a valid email address"),
});

export const insertQuoteTemplateSchema = createInsertSchema(quoteTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertProjectVendorSchema = createInsertSchema(projectVendors).omit({
  id: true,
  submittedAt: true,
});

export const insertBoqSchema = createInsertSchema(boq).omit({
  id: true,
});

export const insertQuoteFileSchema = createInsertSchema(quoteFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertFloorPlanSchema = createInsertSchema(floorPlans).omit({
  id: true,
  uploadedAt: true,
});

export const insertMoodboardSchema = createInsertSchema(moodboards).omit({
  id: true,
  uploadedAt: true,
});

// Types
export type InsertVendorCategory = z.infer<typeof insertVendorCategorySchema>;
export type VendorCategory = typeof vendorCategories.$inferSelect;

export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertQuoteTemplate = z.infer<typeof insertQuoteTemplateSchema>;
export type QuoteTemplate = typeof quoteTemplates.$inferSelect;

export type InsertProjectVendor = z.infer<typeof insertProjectVendorSchema>;
export type ProjectVendor = typeof projectVendors.$inferSelect;

export type InsertBoq = z.infer<typeof insertBoqSchema>;
export type Boq = typeof boq.$inferSelect;

export type InsertQuoteFile = z.infer<typeof insertQuoteFileSchema>;
export type QuoteFile = typeof quoteFiles.$inferSelect;

export type InsertFloorPlan = z.infer<typeof insertFloorPlanSchema>;
export type FloorPlan = typeof floorPlans.$inferSelect;

export type InsertMoodboard = z.infer<typeof insertMoodboardSchema>;
export type Moodboard = typeof moodboards.$inferSelect;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // Replit provides stable user ID, no UUID generation needed
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User roles table to maintain role-based access control
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("client"), // admin, designer, client
  isActive: boolean("is_active").notNull().default(true),
  assignedBy: varchar("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").notNull().default(sql`now()`),
});

// Designer Email Allowlist - predefined emails that should have designer role
export const designerAllowlist = pgTable("designer_allowlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  addedBy: varchar("added_by").references(() => users.id),
  addedAt: timestamp("added_at").notNull().default(sql`now()`),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  assignedAt: true,
});

export const insertDesignerAllowlistSchema = createInsertSchema(designerAllowlist).omit({
  id: true,
  addedAt: true,
});

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertDesignerAllowlist = z.infer<typeof insertDesignerAllowlistSchema>;
export type DesignerAllowlist = typeof designerAllowlist.$inferSelect;
