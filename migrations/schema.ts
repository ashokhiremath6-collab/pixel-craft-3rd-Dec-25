import { pgTable, foreignKey, varchar, text, numeric, timestamp, boolean, jsonb, date, index, unique, json } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const quoteFiles = pgTable("quote_files", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectVendorId: varchar("project_vendor_id").notNull(),
	fileName: text("file_name").notNull(),
	filePath: text("file_path").notNull(),
	fileType: text("file_type").notNull(),
	fileSize: numeric("file_size"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	externalStorageProvider: text("external_storage_provider"),
	externalFileId: text("external_file_id"),
}, (table) => [
	foreignKey({
			columns: [table.projectVendorId],
			foreignColumns: [projectVendors.id],
			name: "quote_files_project_vendor_id_project_vendors_id_fk"
		}),
]);

export const vendorCategories = pgTable("vendor_categories", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	parentId: varchar("parent_id"),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
});

export const floorPlans = pgTable("floor_plans", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id").notNull(),
	name: text().notNull(),
	description: text(),
	fileName: text("file_name").notNull(),
	filePath: text("file_path").notNull(),
	fileType: text("file_type").notNull(),
	fileSize: numeric("file_size"),
	version: text().default('1.0').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "floor_plans_project_id_projects_id_fk"
		}),
]);

export const boq = pgTable("boq", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectVendorId: varchar("project_vendor_id").notNull(),
	itemDescription: text("item_description").notNull(),
	quantity: numeric({ precision: 10, scale:  2 }).notNull(),
	unit: text().notNull(),
	unitRate: numeric("unit_rate", { precision: 10, scale:  2 }).notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	category: text(),
	itemCode: text("item_code"),
	specifications: text(),
}, (table) => [
	foreignKey({
			columns: [table.projectVendorId],
			foreignColumns: [projectVendors.id],
			name: "boq_project_vendor_id_project_vendors_id_fk"
		}),
]);

export const vendors = pgTable("vendors", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	categoryId: varchar("category_id").notNull(),
	contactPerson: text("contact_person").notNull(),
	phone: text().notNull(),
	email: text().notNull(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [vendorCategories.id],
			name: "vendors_category_id_vendor_categories_id_fk"
		}),
]);

export const quoteTemplates = pgTable("quote_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	categoryId: varchar("category_id").notNull(),
	description: text(),
	templateFile: text("template_file"),
	fields: jsonb(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	originalFileData: text("original_file_data"),
	originalFileName: text("original_file_name"),
	originalMimeType: text("original_mime_type"),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [vendorCategories.id],
			name: "quote_templates_category_id_vendor_categories_id_fk"
		}),
]);

export const projects = pgTable("projects", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectName: text("project_name").notNull(),
	clientName: text("client_name").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	clientEmail: text("client_email").default(').notNull(),
});

export const projectVendors = pgTable("project_vendors", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id").notNull(),
	vendorId: varchar("vendor_id").notNull(),
	quotationFile: text("quotation_file"),
	quotationValue: numeric("quotation_value", { precision: 10, scale:  2 }),
	dateOfQuotation: date("date_of_quotation"),
	status: text().default('Quoted').notNull(),
	notes: text(),
	templateId: varchar("template_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow(),
	quotationName: text("quotation_name").default('Main Quote').notNull(),
	quotationType: text("quotation_type").default('item').notNull(),
	parentQuotationId: varchar("parent_quotation_id"),
	itemCategory: text("item_category"),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_vendors_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "project_vendors_vendor_id_vendors_id_fk"
		}),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [quoteTemplates.id],
			name: "project_vendors_template_id_quote_templates_id_fk"
		}),
	foreignKey({
			columns: [table.parentQuotationId],
			foreignColumns: [table.id],
			name: "project_vendors_parent_quotation_id_fkey"
		}),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: text().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	name: varchar(),
	username: varchar(),
	imageUrl: varchar("image_url"),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_username_unique").on(table.email),
]);

export const userRoles = pgTable("user_roles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	role: text().default('client').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	assignedBy: varchar("assigned_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_fkey"
		}),
]);

export const designerAllowlist = pgTable("designer_allowlist", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: text().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	addedBy: varchar("added_by").notNull(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.addedBy],
			foreignColumns: [users.id],
			name: "designer_allowlist_added_by_fkey"
		}),
	unique("designer_allowlist_email_key").on(table.email),
]);

export const userRoles = pgTable("userRoles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	role: varchar().default('client').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	assignedBy: varchar("assigned_by"),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow(),
});

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);
