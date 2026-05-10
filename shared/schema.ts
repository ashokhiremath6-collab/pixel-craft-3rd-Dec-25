import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, numeric, date, boolean, jsonb, index, uniqueIndex, integer } from "drizzle-orm/pg-core";
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

// Vendor Contacts table - supports multiple contact persons per vendor
export const vendorContacts = pgTable("vendor_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  contactPerson: text("contact_person").notNull(),
  phone: text("phone").notNull(),
  email: text("email"), // Optional - some contacts may not have email
  role: text("role"), // Optional role (e.g., "Sales Manager", "Project Lead", "Accounts")
  isPrimary: boolean("is_primary").notNull().default(false), // Mark one contact as primary
  addedAt: timestamp("added_at").notNull().default(sql`now()`),
});

// Projects table  
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectName: text("project_name").notNull(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull().default(''), // Email for client access control (deprecated - use projectClients)
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  canvaLink: text("canva_link"), // Canva design link for the project
  ganttChartLink: text("gantt_chart_link"), // External Gantt chart link (e.g., Google Sheets, MS Project Online)
  foyrNeoLink: text("foyr_neo_link"), // Foyr Neo 3D design project link
  orgId: varchar("org_id"), // org that owns this project (nullable for legacy projects)
}, (table) => ({
  orgIdIdx: index("projects_org_id_idx").on(table.orgId),
}));

// Project Clients table - supports multiple clients per project
export const projectClients = pgTable("project_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  clientEmail: text("client_email").notNull(),
  clientName: text("client_name"), // Optional name for the client (e.g., "John Doe", "Architect")
  role: text("role"), // Optional role (e.g., "Family Member", "Architect", "Contractor")
  addedAt: timestamp("added_at").notNull().default(sql`now()`),
}, (table) => ({
  // Composite unique constraint to prevent duplicate emails per project
  uniqueProjectClient: uniqueIndex("unique_project_client").on(table.projectId, table.clientEmail),
}));

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
  vendorId: varchar("vendor_id").references(() => vendors.id), // Nullable for comparative statements
  categoryId: varchar("category_id").references(() => vendorCategories.id), // Nullable, for precise category lookup
  category: text("category"), // For comparative statements: category name instead of vendor
  quotationName: text("quotation_name").notNull().default("Main Quote"), // "Option A", "Kitchen Cabinets", etc.
  quotationType: text("quotation_type").notNull().default("item"), // "item" or "option"
  parentQuotationId: varchar("parent_quotation_id"), // Self-reference for grouping options - added later
  itemCategory: text("item_category"), // For folder organization
  quotationFile: text("quotation_file"), // file path/url
  quotationValue: decimal("quotation_value", { precision: 15, scale: 2 }),
  dateOfQuotation: date("date_of_quotation"),
  status: text("status").notNull().default("Quoted"), // Quoted, Selected, Rejected
  isNegotiated: boolean("is_negotiated").notNull().default(false), // Mark final negotiated quotes
  notes: text("notes"),
  templateId: varchar("template_id").references(() => quoteTemplates.id),
  submittedAt: timestamp("submitted_at").default(sql`now()`),
  unitRateSubtype: text("unit_rate_subtype"), // For unit rate quotes: "quote" or "comparative"
});

// BOQ (Bill of Quantities) table
export const boq = pgTable("boq", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectVendorId: varchar("project_vendor_id").notNull().references(() => projectVendors.id),
  itemDescription: text("item_description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  unit: text("unit").notNull(), // m², kg, pieces, etc.
  unitRate: decimal("unit_rate", { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
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

// Moodboards table (also used for working drawings and renders)
export const moodboards = pgTable("moodboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id), // Optional - can be null for general moodboards
  assetType: text("asset_type").notNull().default("moodboard"), // "moodboard", "working_drawing", "render"
  name: text("name").notNull(),
  description: text("description"),
  folder: text("folder"), // For organizing working drawings into folders
  fileName: text("file_name"), // Optional - can be null for Canva-link-only entries
  filePath: text("file_path"), // Optional - path in object storage
  fileType: text("file_type"), // Optional - jpeg, png, svg, webp, pdf, etc.
  fileSize: decimal("file_size"), // Optional - in bytes
  tags: jsonb("tags"), // Array of tags for organization
  canvaLink: text("canva_link"), // Canva design link for the moodboard
  roomType: text("room_type"), // For renders: living room, bedroom, kitchen, etc. (extracted from filename)
  referenceMetadata: jsonb("reference_metadata"), // For AI renders: array of catalogue items used as references
  savedBy: varchar("saved_by").references(() => users.id), // User who saved the render
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
});

// Project Schedules table for tracking uploaded Gantt files
export const projectSchedules = pgTable("project_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  fileName: text("file_name").notNull(),
  version: text("version").notNull().default("1.0"),
  filePath: text("file_path").notNull(), // path in object storage
  fileSize: decimal("file_size"), // in bytes
  status: text("status").notNull().default("active"), // active, archived
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
});

// Tasks table for Gantt chart task management
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  scheduleId: varchar("schedule_id").references(() => projectSchedules.id), // link to uploaded schedule
  taskId: text("task_id"), // external task ID from uploaded file (e.g., "1", "2.1", etc.)
  rowIndex: integer("row_index"), // original Excel/CSV row position (0-based) for stable ordering
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  duration: decimal("duration", { precision: 10, scale: 2 }), // in days
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: text("status").notNull().default("not_started"), // not_started, in_progress, blocked, completed, overdue
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 }).default("0"),
  predecessorIds: text("predecessor_ids").array(), // array of task IDs
  isCriticalPath: boolean("is_critical_path").notNull().default(false), // calculated field for critical path
  approvalRequired: boolean("approval_required").notNull().default(false),
  approvalStatus: text("approval_status"), // pending, approved, rejected
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  materials: text("materials"), // materials or resources from MS Project / Excel
  owner: text("owner"), // owner or responsible person from schedule file
  targetStartDate: date("target_start_date"), // baseline/target start date
  targetEndDate: date("target_end_date"), // baseline/target finish date
  outlineLevel: integer("outline_level"), // WBS hierarchy level (1 = top-level phase, 2+ = sub-tasks)
  color: text("color"), // optional color code for visual differentiation
  subcategory: text("subcategory"), // designer-defined sub-grouping within a category, e.g. "Master Bedroom"
  remarks: text("remarks"), // free-text field for project manager notes, delay reasons, stage updates
  deadlineHistory: jsonb("deadline_history").$type<Array<{ previousDeadline: string; newDeadline: string; reason: string; extendedBy: string; extendedByName: string; extendedAt: string }>>().default([]), // log of all deadline extensions
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Task Dependencies table for managing task relationships
export const taskDependencies = pgTable("task_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromTaskId: varchar("from_task_id").notNull().references(() => tasks.id),
  toTaskId: varchar("to_task_id").notNull().references(() => tasks.id),
  dependencyType: text("dependency_type").notNull().default("finish_to_start"), // finish_to_start, start_to_start, finish_to_finish, start_to_finish
  lag: decimal("lag", { precision: 10, scale: 2 }).default("0"), // lag time in days (can be negative for lead time)
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Task Alerts table for tracking notifications
export const taskAlerts = pgTable("task_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  alertType: text("alert_type").notNull(), // deadline_upcoming, overdue, dependency_complete, approval_pending, status_change, critical_path_change
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  triggeredAt: timestamp("triggered_at").notNull().default(sql`now()`),
});

// Approvals table for task approval workflow
export const approvals = pgTable("approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  requestedBy: varchar("requested_by").notNull().references(() => users.id),
  approverId: varchar("approver_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  comments: text("comments"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  resolvedAt: timestamp("resolved_at"),
});

// Activity Log table for tracking file uploads and user actions
export const activityLog = pgTable("activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  userName: text("user_name").notNull(), // Denormalized for display
  userEmail: text("user_email").notNull(), // Denormalized for display
  projectId: varchar("project_id").references(() => projects.id), // Optional, for project-specific activities
  activityType: text("activity_type").notNull(), // floor_plan, moodboard, quote_file, boq_file, schedule, working_drawing, render, specification, vendor_payment, vendor_create, vendor_update, vendor_delete, catalogue_upload, catalogue_update, catalogue_delete
  fileName: text("file_name").notNull(),
  filePath: text("file_path"), // Optional file path
  description: text("description").notNull(), // "uploaded Floor Plan", "uploaded Moodboard", etc.
  metadata: jsonb("metadata"), // Additional data like projectVendorId, vendorId, etc.
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Vendor Invoices table for tracking invoices raised to vendors
export const vendorInvoices = pgTable("vendor_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  projectId: varchar("project_id").references(() => projects.id), // Optional - can be null for general invoices
  invoiceNumber: varchar("invoice_number").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  attachmentPath: text("attachment_path"), // Optional PDF attachment in object storage
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  vendorIdIdx: index("idx_vendor_invoices_vendor_id").on(table.vendorId),
  projectIdIdx: index("idx_vendor_invoices_project_id").on(table.projectId),
}));

// Vendor Payments table for recording payments made to vendors
export const vendorPayments = pgTable("vendor_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id),
  paymentDate: date("payment_date").notNull(),
  paymentReference: varchar("payment_reference").notNull(), // Payment reference number
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method").notNull(), // cash, cheque, upi, bank_transfer
  notes: text("notes"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  attachmentPath: text("attachment_path"),
}, (table) => ({
  vendorIdIdx: index("idx_vendor_payments_vendor_id").on(table.vendorId),
}));

// Catalogue Items table for interior design product taxonomy
export const catalogueItems = pgTable("catalogue_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"), // FK to organisations — null for seed/legacy rows; set for all new items
  mainCategory: text("main_category").notNull(), // Furniture, Lighting, Kitchens, etc.
  subcategory: text("subcategory").notNull(), // Sofas & Sectionals, Ceiling Lights, etc.
  vendorBrand: text("vendor_brand"), // Vendor or brand name
  description: text("description"), // Description of the item
  attributes: text("attributes").notNull().default(''), // Comma-separated attributes (e.g., "Style, seats, fabric/leather")
  catalogueUrl: text("catalogue_url"), // Optional URL link to online catalogue
  fileName: text("file_name"), // Original name of uploaded catalogue file
  filePath: text("file_path"), // Object storage path to the catalogue file
  aiImagePath: text("ai_image_path"), // Optional specific image for AI render references
  aiPromptHints: text("ai_prompt_hints"), // Optional AI-specific hints (e.g., "oak chevron pattern hardwood flooring")
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  mainCategoryIdx: index("catalogue_main_category_idx").on(table.mainCategory),
  orgIdIdx: index("catalogue_items_org_id_idx").on(table.orgId),
}));

// Object Assets table for uploaded photos of art, furniture, etc.
export const objectAssets = pgTable("object_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectType: text("object_type").notNull(), // art, furniture, decor, lighting, textile, accessory
  originalFileName: text("original_file_name").notNull(),
  originalFilePath: text("original_file_path").notNull(), // Original uploaded image in object storage
  processedFilePath: text("processed_file_path"), // Enhanced/cropped version
  thumbnailPath: text("thumbnail_path"), // Small thumbnail for previews
  transparentPath: text("transparent_path"), // Background-removed version for renders
  processingStatus: text("processing_status").notNull().default("pending"), // pending, processing, completed, failed
  processingError: text("processing_error"), // Error message if processing failed
  detectedBounds: jsonb("detected_bounds"), // {x, y, width, height} for detected object region
  dimensions: jsonb("dimensions"), // {width, height} of processed image
  aiDescription: text("ai_description"), // AI-generated description of the object
  aiPromptHints: text("ai_prompt_hints"), // Hints for using in AI render generation
  processingInstructions: text("processing_instructions"), // User instructions for AI-based processing (centering, brightness, etc.)
  userDescription: text("user_description"), // User-provided description
  catalogueItemId: varchar("catalogue_item_id").references(() => catalogueItems.id), // Link if saved to catalogue
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  processedAt: timestamp("processed_at"), // When processing completed
  reprocessCount: integer("reprocess_count").notNull().default(0), // Number of times reprocessed
}, (table) => ({
  objectTypeIdx: index("object_assets_type_idx").on(table.objectType),
  statusIdx: index("object_assets_status_idx").on(table.processingStatus),
}));

// Specifications table for category-wise technical specifications
export const specifications = pgTable("specifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // AC, Audio System, Lighting, etc.
  title: text("title").notNull(), // Specification name/title
  description: text("description"), // Optional description
  fileName: text("file_name").notNull(), // Original file name
  filePath: text("file_path").notNull(), // Object storage path
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`),
});

// Saved Assets table for finalized processed images ready for use in renders
export const savedAssets = pgTable("saved_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  displayName: text("display_name").notNull(), // User-provided name for the asset
  description: text("description"), // Optional description
  tags: text("tags"), // Comma-separated tags for search/filter
  filePath: text("file_path").notNull(), // Object storage path to the saved image
  thumbnailPath: text("thumbnail_path"), // Optional thumbnail for faster loading
  sourceType: text("source_type").notNull().default("object_asset"), // object_asset, upload, catalogue
  objectAssetId: varchar("object_asset_id").references(() => objectAssets.id), // Link to source object asset if any
  catalogueItemId: varchar("catalogue_item_id").references(() => catalogueItems.id), // Link to source catalogue item if any
  aiPromptHints: text("ai_prompt_hints"), // Hints for using in AI render generation
  savedBy: varchar("saved_by").notNull().references(() => users.id),
  savedAt: timestamp("saved_at").notNull().default(sql`now()`),
}, (table) => ({
  sourceTypeIdx: index("saved_assets_source_type_idx").on(table.sourceType),
  savedByIdx: index("saved_assets_saved_by_idx").on(table.savedBy),
}));

// Works Order Templates table for reusable templates (file-based)
export const worksOrderTemplates = pgTable("works_order_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Template name (derived from filename or user-provided)
  categoryId: varchar("category_id").references(() => vendorCategories.id), // Category for organization
  description: text("description"), // Template description
  objectPath: text("object_path").notNull(), // Path to template file in object storage
  originalFileName: text("original_file_name").notNull(), // Original uploaded filename
  mimeType: text("mime_type"), // File MIME type
  fileSize: integer("file_size"), // File size in bytes
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  // Index for faster filtering by category
  categoryIdx: index("works_order_templates_category_idx").on(table.categoryId),
}));

// Works Orders table for tracking client-signed work orders
export const worksOrders = pgTable("works_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectVendorId: varchar("project_vendor_id").notNull().references(() => projectVendors.id), // Links to quote
  quoteFileId: varchar("quote_file_id").references(() => quoteFiles.id), // Optional link to specific quote file
  templateId: varchar("template_id"), // Template used
  templateVersion: text("template_version"), // Snapshot of template at send time
  serialCounter: integer("serial_counter").notNull(), // Sequential counter for order numbering
  orderNumber: text("order_number").notNull().unique(), // Auto-generated order number (e.g., 1141125)
  title: text("title").notNull(), // Works order title
  scope: text("scope").notNull(), // Scope of work description
  paymentTerms: text("payment_terms"), // Payment terms and schedule
  startDate: date("start_date"), // Expected start date
  completionDate: date("completion_date"), // Expected completion date
  totalValue: decimal("total_value", { precision: 15, scale: 2 }), // Total value of work
  status: text("status").notNull().default("draft"), // draft, sent, signed, void
  draftFilePath: text("draft_file_path"), // Path to generated draft PDF
  signedFilePath: text("signed_file_path"), // Path to signed PDF with embedded signatures
  accessToken: text("access_token"), // Unique token for client access
  sentAt: timestamp("sent_at"), // When sent to client
  signedAt: timestamp("signed_at"), // When fully signed
  voidedAt: timestamp("voided_at"), // When voided
  voidReason: text("void_reason"), // Reason for voiding
  notes: text("notes"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  // Index for faster filtering by status
  statusIdx: index("works_orders_status_idx").on(table.status),
  // Index for order number lookup
  orderNumberIdx: index("works_orders_order_number_idx").on(table.orderNumber),
}));

// Works Order Signatures table for tracking who signed and when
export const worksOrderSignatures = pgTable("works_order_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  worksOrderId: varchar("works_order_id").notNull().references(() => worksOrders.id, { onDelete: 'cascade' }),
  signerId: varchar("signer_id").references(() => users.id), // User who signed (null for clients)
  signerEmail: text("signer_email").notNull(), // Email of signer
  signerName: text("signer_name").notNull(), // Name of signer
  signerRole: text("signer_role").notNull(), // "client", "designer", "admin"
  signatureMethod: text("signature_method").notNull(), // "drawn", "typed", "uploaded"
  signatureData: text("signature_data"), // Base64 signature image or typed text
  signaturePath: text("signature_path"), // Path to signature file in object storage
  ipAddress: text("ip_address"), // IP address of signer for audit
  signedAt: timestamp("signed_at").notNull().default(sql`now()`),
});

// Works Order Items table for structured line items (supports merging quotes + imported orders)
export const worksOrderItems = pgTable("works_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  worksOrderId: varchar("works_order_id").notNull().references(() => worksOrders.id, { onDelete: 'cascade' }),
  description: text("description").notNull(), // Item description
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  unit: text("unit").notNull(), // m², kg, pieces, etc.
  unitRate: decimal("unit_rate", { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  category: text("category"), // labor, material, equipment, etc.
  itemCode: text("item_code"),
  specifications: text("specifications"),
  sourceProjectVendorId: varchar("source_project_vendor_id").references(() => projectVendors.id), // Traceability to quote
  sourceWorksOrderId: varchar("source_works_order_id").references(() => worksOrders.id, { onDelete: 'set null' }), // Traceability to imported order
  sortOrder: decimal("sort_order", { precision: 10, scale: 0 }).notNull().default(sql`0`), // Display order
}, (table) => ({
  // Composite index for ordered lookup
  worksOrderSortIdx: index("works_order_items_order_sort_idx").on(table.worksOrderId, table.sortOrder),
}));

// Works Order Files table for storing multiple file attachments per works order
export const worksOrderFiles = pgTable("works_order_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  worksOrderId: varchar("works_order_id").notNull().references(() => worksOrders.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(), // path in object storage
  fileType: text("file_type").notNull(), // pdf, xlsx, doc, etc.
  fileSize: text("file_size").notNull(),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
}, (table) => ({
  worksOrderIdx: index("works_order_files_works_order_idx").on(table.worksOrderId),
}));

// Insert schemas
export const insertVendorCategorySchema = createInsertSchema(vendorCategories).omit({
  id: true,
});

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
}).extend({
  // Email is required
  email: z.string().min(1, "You need to enter an email ID.").email("You need to enter an email ID."),
});

export const insertVendorContactSchema = createInsertSchema(vendorContacts).omit({
  id: true,
  addedAt: true,
}).extend({
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
}).extend({
  clientEmail: z.string().email("Please enter a valid email address"),
  foyrNeoLink: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
});

export const insertProjectClientSchema = createInsertSchema(projectClients).omit({
  id: true,
  addedAt: true,
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
}).extend({
  assetType: z.enum(["moodboard", "working_drawing", "render"]).default("moodboard"),
});

export const insertProjectScheduleSchema = createInsertSchema(projectSchedules).omit({
  id: true,
  uploadedAt: true,
}).extend({
  status: z.enum(["active", "archived"]).default("active"),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["not_started", "in_progress", "blocked", "completed", "overdue"]).default("not_started"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
}).extend({
  dependencyType: z.enum(["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"]).default("finish_to_start"),
});

export const insertTaskAlertSchema = createInsertSchema(taskAlerts).omit({
  id: true,
  triggeredAt: true,
}).extend({
  alertType: z.enum(["deadline_upcoming", "overdue", "dependency_complete", "approval_pending", "status_change", "critical_path_change"]),
});

export const insertApprovalSchema = createInsertSchema(approvals).omit({
  id: true,
  createdAt: true,
}).extend({
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
}).extend({
  activityType: z.enum(["floor_plan", "moodboard", "quote_file", "boq_file", "schedule", "working_drawing", "render", "specification", "vendor_payment", "vendor_create", "vendor_update", "vendor_delete", "catalogue_upload", "catalogue_update", "catalogue_delete", "works_order_create", "works_order_send", "works_order_sign", "works_order_void"]),
});

export const insertVendorInvoiceSchema = createInsertSchema(vendorInvoices).omit({
  id: true,
  createdAt: true,
});

export const insertVendorPaymentSchema = createInsertSchema(vendorPayments).omit({
  id: true,
  createdAt: true,
}).extend({
  paymentMethod: z.enum(["cash", "cheque", "upi", "bank_transfer"]),
});

export const insertCatalogueItemSchema = createInsertSchema(catalogueItems).omit({
  id: true,
  createdAt: true,
}).extend({
  mainCategory: z.string().min(1, "Main category is required"),
  subcategory: z.string().min(1, "Subcategory is required"),
  attributes: z.string(), // Can be empty
  orgId: z.string().nullable().optional(), // set server-side from authenticated user
});

export const insertObjectAssetSchema = createInsertSchema(objectAssets).omit({
  id: true,
  createdAt: true,
  processedAt: true,
}).extend({
  objectType: z.enum(["art", "furniture", "decor", "lighting", "textile", "accessory"]),
  processingStatus: z.enum(["pending", "processing", "completed", "failed"]).default("pending"),
});

export const insertSpecificationSchema = createInsertSchema(specifications).omit({
  id: true,
  uploadedAt: true,
});

export const insertSavedAssetSchema = createInsertSchema(savedAssets).omit({
  id: true,
  savedAt: true,
});

export const insertWorksOrderTemplateSchema = createInsertSchema(worksOrderTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorksOrderSchema = createInsertSchema(worksOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(["draft", "sent", "signed", "void"]).default("draft"),
  serialCounter: z.number().int().positive(), // Must be provided from sequence
});

export const insertWorksOrderSignatureSchema = createInsertSchema(worksOrderSignatures).omit({
  id: true,
  signedAt: true,
}).extend({
  signerRole: z.enum(["client", "designer", "admin"]),
  signatureMethod: z.enum(["drawn", "typed", "uploaded"]),
});

export const insertWorksOrderItemSchema = createInsertSchema(worksOrderItems).omit({
  id: true,
});

export const insertWorksOrderFileSchema = createInsertSchema(worksOrderFiles).omit({
  id: true,
  uploadedAt: true,
});

// Types
export type InsertVendorCategory = z.infer<typeof insertVendorCategorySchema>;
export type VendorCategory = typeof vendorCategories.$inferSelect;

export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

export type InsertVendorContact = z.infer<typeof insertVendorContactSchema>;
export type VendorContact = typeof vendorContacts.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertProjectClient = z.infer<typeof insertProjectClientSchema>;
export type ProjectClient = typeof projectClients.$inferSelect;

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

export type InsertProjectSchedule = z.infer<typeof insertProjectScheduleSchema>;
export type ProjectSchedule = typeof projectSchedules.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type TaskDependency = typeof taskDependencies.$inferSelect;

export type InsertTaskAlert = z.infer<typeof insertTaskAlertSchema>;
export type TaskAlert = typeof taskAlerts.$inferSelect;

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvals.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;

export type InsertVendorInvoice = z.infer<typeof insertVendorInvoiceSchema>;
export type VendorInvoice = typeof vendorInvoices.$inferSelect;

export type InsertVendorPayment = z.infer<typeof insertVendorPaymentSchema>;
export type VendorPayment = typeof vendorPayments.$inferSelect;

export type InsertCatalogueItem = z.infer<typeof insertCatalogueItemSchema>;
export type CatalogueItem = typeof catalogueItems.$inferSelect;

export type InsertObjectAsset = z.infer<typeof insertObjectAssetSchema>;
export type ObjectAsset = typeof objectAssets.$inferSelect;

export type InsertSpecification = z.infer<typeof insertSpecificationSchema>;
export type Specification = typeof specifications.$inferSelect;

export type InsertSavedAsset = z.infer<typeof insertSavedAssetSchema>;
export type SavedAsset = typeof savedAssets.$inferSelect;

export type InsertWorksOrderTemplate = z.infer<typeof insertWorksOrderTemplateSchema>;
export type WorksOrderTemplate = typeof worksOrderTemplates.$inferSelect;

export type InsertWorksOrder = z.infer<typeof insertWorksOrderSchema>;
export type WorksOrder = typeof worksOrders.$inferSelect;

export type InsertWorksOrderSignature = z.infer<typeof insertWorksOrderSignatureSchema>;
export type WorksOrderSignature = typeof worksOrderSignatures.$inferSelect;

export type InsertWorksOrderItem = z.infer<typeof insertWorksOrderItemSchema>;
export type WorksOrderItem = typeof worksOrderItems.$inferSelect;

export type InsertWorksOrderFile = z.infer<typeof insertWorksOrderFileSchema>;
export type WorksOrderFile = typeof worksOrderFiles.$inferSelect;

// Meeting Minutes table
export const meetingMinutes = pgTable("meeting_minutes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id), // Nullable for general/company meetings
  meetingDate: date("meeting_date").notNull(),
  meetingTitle: text("meeting_title").notNull(),
  meetingType: text("meeting_type").notNull(), // Client Meeting, Internal Meeting, Site Visit, Vendor Meeting, Design Review
  attendees: text("attendees"), // Optional: Comma-separated or newline-separated list
  location: text("location"), // Office, Site, Online/Video Call, Client Office, etc.
  source: text("source").default("manual"), // 'manual' for PM uploads, 'fireflies' for AI-converted
  filePath: text("file_path").notNull(), // path to MOM document in object storage
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // pdf, doc, docx, etc.
  fileSize: decimal("file_size"), // in bytes
  summary: text("summary"), // Optional text summary of key points
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_meeting_date").on(table.meetingDate),
  index("idx_project_id").on(table.projectId),
]);

export const insertMeetingMinutesSchema = createInsertSchema(meetingMinutes).omit({
  id: true,
  uploadedAt: true,
}).extend({
  projectId: z.string().optional().nullable(),
  attendees: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  fileSize: z.union([z.string(), z.number()]).optional().nullable(),
});

export type InsertMeetingMinutes = z.infer<typeof insertMeetingMinutesSchema>;
export type MeetingMinutes = typeof meetingMinutes.$inferSelect;

// Meeting Action Items table (for structured Fireflies conversion)
export const meetingActionItems = pgTable("meeting_action_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingMinutesId: varchar("meeting_minutes_id").references(() => meetingMinutes.id, { onDelete: 'cascade' }).notNull(),
  serialNo: integer("serial_no").notNull(),
  issueDiscussed: text("issue_discussed").notNull(),
  responsibility: text("responsibility"),
  deadline: date("deadline"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_meeting_action_meeting_id").on(table.meetingMinutesId),
]);

export const insertMeetingActionItemSchema = createInsertSchema(meetingActionItems).omit({
  id: true,
  createdAt: true,
}).extend({
  responsibility: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export type InsertMeetingActionItem = z.infer<typeof insertMeetingActionItemSchema>;
export type MeetingActionItem = typeof meetingActionItems.$inferSelect;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey().notNull(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Organisations table — each workspace belongs to one organisation
export const organisations = pgTable("organisations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: varchar("slug").notNull().unique(), // URL-safe identifier
  plan: text("plan").notNull().default("trial"), // trial, starter, pro, enterprise
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planStatus: text("plan_status").notNull().default("trialing"), // trialing, active, past_due, cancelled
  currentPeriodEnd: timestamp("current_period_end"),
  trialExpiryNotifiedAt: timestamp("trial_expiry_notified_at"), // last time a trial-expiry warning was auto-sent
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Notification preferences shape stored per-user in jsonb
export interface NotificationPreferences {
  // Admin-relevant preferences
  planChanges: boolean;
  paymentFailures: boolean;
  trialExpiry: boolean;
  // Non-admin-relevant preferences
  invitationAccepted: boolean;
  projectUpdates: boolean;
}

export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    planChanges: true,
    paymentFailures: true,
    trialExpiry: true,
    invitationAccepted: true,
    projectUpdates: true,
  };
}

export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  const defaults = defaultNotificationPreferences();
  if (!raw || typeof raw !== "object") return defaults;
  const p = raw as Record<string, unknown>;
  return {
    planChanges: typeof p.planChanges === "boolean" ? p.planChanges : defaults.planChanges,
    paymentFailures: typeof p.paymentFailures === "boolean" ? p.paymentFailures : defaults.paymentFailures,
    trialExpiry: typeof p.trialExpiry === "boolean" ? p.trialExpiry : defaults.trialExpiry,
    invitationAccepted: typeof p.invitationAccepted === "boolean" ? p.invitationAccepted : defaults.invitationAccepted,
    projectUpdates: typeof p.projectUpdates === "boolean" ? p.projectUpdates : defaults.projectUpdates,
  };
}

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`).notNull(),
  email: text("email").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at"),
  emailVerificationToken: varchar("email_verification_token").unique(),
  passwordResetToken: varchar("password_reset_token").unique(),
  passwordResetTokenExpiry: timestamp("password_reset_token_expiry"),
  orgId: varchar("org_id"), // FK to organisations; null for legacy users
  onboardingCompletedAt: timestamp("onboarding_completed_at"), // null = wizard not yet shown
  isSuperAdmin: boolean("is_super_admin").notNull().default(false), // system-level super-admin flag
  notificationPreferences: jsonb("notification_preferences"), // NotificationPreferences; null = all enabled
  unsubscribeToken: varchar("unsubscribe_token").unique(), // token for one-click email unsubscribe (no login required)
  trialBannerSnoozedUntil: timestamp("trial_banner_snoozed_until"), // server-side snooze preference for trial expiry banner; null = not snoozed
  trialBannerSnoozeDuration: text("trial_banner_snooze_duration"), // "1", "3", or "forever"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  imageUrl: varchar("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  name: varchar("name"),
  username: varchar("username"),
});

// User roles table to maintain role-based access control
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("client"), // admin, designer, project_manager, client
  isActive: boolean("is_active").notNull().default(true),
  assignedBy: varchar("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").default(sql`now()`),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

// User Project Assignments - tracks which projects users (especially project managers) can access
export const userProjectAssignments = pgTable("user_project_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  assignedBy: varchar("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").notNull().default(sql`now()`),
}, (table) => ({
  // Composite unique constraint to prevent duplicate assignments
  uniqueUserProject: uniqueIndex("unique_user_project").on(table.userId, table.projectId),
}));

// Designer Email Allowlist - predefined emails that should have designer role
export const designerAllowlist = pgTable("designer_allowlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  addedBy: varchar("added_by").notNull().references(() => users.id),
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

export const insertUserProjectAssignmentSchema = createInsertSchema(userProjectAssignments).omit({
  id: true,
  assignedAt: true,
});

export type InsertUserProjectAssignment = z.infer<typeof insertUserProjectAssignmentSchema>;
export type UserProjectAssignment = typeof userProjectAssignments.$inferSelect;

export type InsertDesignerAllowlist = z.infer<typeof insertDesignerAllowlistSchema>;
export type DesignerAllowlist = typeof designerAllowlist.$inferSelect;

// Invitations table — org admins invite team members via email token
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(), // references organisations.id
  email: text("email").notNull(),
  role: text("role").notNull().default("designer"), // admin, designer, project_manager, client
  token: varchar("token").notNull().unique(),
  invitedBy: varchar("invited_by").notNull(), // references users.id
  acceptedAt: timestamp("accepted_at"), // null = pending
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

export const insertOrganisationSchema = createInsertSchema(organisations).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;
export type Organisation = typeof organisations.$inferSelect;

// SOPs (Standard Operating Procedures)
export const sops = pgTable("sops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  content: text("content"),
  fileName: text("file_name"),
  filePath: text("file_path"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  categoryIdx: index("sops_category_idx").on(table.category),
}));

export const insertSopSchema = createInsertSchema(sops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSop = z.infer<typeof insertSopSchema>;
export type Sop = typeof sops.$inferSelect;

// Super-admin audit log — every privileged action is recorded here
export const superadminAuditLog = pgTable("superadmin_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  superAdminId: varchar("super_admin_id").references(() => users.id), // nullable for system/webhook-triggered events
  action: text("action").notNull(), // plan_override, impersonate
  targetOrgId: varchar("target_org_id").references(() => organisations.id),
  targetUserId: varchar("target_user_id").references(() => users.id),
  metadata: jsonb("metadata"), // e.g. { previousPlan, newPlan }
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => ({
  superAdminIdx: index("superadmin_audit_super_admin_idx").on(table.superAdminId),
  createdAtIdx: index("superadmin_audit_created_at_idx").on(table.createdAt),
}));

export type SuperadminAuditLog = typeof superadminAuditLog.$inferSelect;
export type InsertSuperadminAuditLog = typeof superadminAuditLog.$inferInsert;

// Roles that can read billing status (used by both server and client to stay in sync)
export const BILLING_VISIBLE_ROLES = ['admin', 'designer', 'project_manager'] as const;
