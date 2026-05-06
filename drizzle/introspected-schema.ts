import { pgTable, index, varchar, json, timestamp, jsonb, text, boolean, foreignKey, numeric, date, unique, integer, uniqueIndex, pgSequence } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const worksOrderSerialSeq = pgSequence("works_order_serial_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const specifications = pgTable("specifications", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	category: text().notNull(),
	title: text().notNull(),
	description: text(),
	fileName: text("file_name").notNull(),
	filePath: text("file_path").notNull(),
	uploadedBy: varchar("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const userRoles = pgTable("userRoles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	role: varchar().default('client').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	assignedBy: varchar("assigned_by"),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow(),
});

export const activityLog = pgTable("activity_log", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	userName: text("user_name").notNull(),
	userEmail: text("user_email").notNull(),
	projectId: varchar("project_id"),
	activityType: text("activity_type").notNull(),
	fileName: text("file_name").notNull(),
	filePath: text("file_path"),
	description: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "activity_log_project_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "activity_log_user_id_fkey"
		}),
]);

export const approvals = pgTable("approvals", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	taskId: varchar("task_id").notNull(),
	requestedBy: varchar("requested_by").notNull(),
	approverId: varchar("approver_id").notNull(),
	status: text().default('pending').notNull(),
	comments: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.approverId],
			foreignColumns: [users.id],
			name: "approvals_approver_id_fkey"
		}),
	foreignKey({
			columns: [table.requestedBy],
			foreignColumns: [users.id],
			name: "approvals_requested_by_fkey"
		}),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "approvals_task_id_fkey"
		}),
]);

export const projectVendors = pgTable("project_vendors", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id").notNull(),
	vendorId: varchar("vendor_id"),
	quotationFile: text("quotation_file"),
	quotationValue: numeric("quotation_value", { precision: 15, scale:  2 }),
	dateOfQuotation: date("date_of_quotation"),
	status: text().default('Quoted').notNull(),
	notes: text(),
	templateId: varchar("template_id"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow(),
	quotationName: text("quotation_name").default('Main Quote').notNull(),
	quotationType: text("quotation_type").default('item').notNull(),
	parentQuotationId: varchar("parent_quotation_id"),
	itemCategory: text("item_category"),
	isNegotiated: boolean("is_negotiated").default(false).notNull(),
	unitRateSubtype: text("unit_rate_subtype"),
	category: text(),
	categoryId: varchar("category_id"),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [vendorCategories.id],
			name: "project_vendors_category_id_fkey"
		}),
	foreignKey({
			columns: [table.parentQuotationId],
			foreignColumns: [table.id],
			name: "project_vendors_parent_quotation_id_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_vendors_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [quoteTemplates.id],
			name: "project_vendors_template_id_quote_templates_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "project_vendors_vendor_id_vendors_id_fk"
		}),
]);

export const boq = pgTable("boq", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectVendorId: varchar("project_vendor_id").notNull(),
	itemDescription: text("item_description").notNull(),
	quantity: numeric({ precision: 15, scale:  2 }).notNull(),
	unit: text().notNull(),
	unitRate: numeric("unit_rate", { precision: 15, scale:  2 }).notNull(),
	totalAmount: numeric("total_amount", { precision: 15, scale:  2 }).notNull(),
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

export const favoriteRenderStyles = pgTable("favorite_render_styles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	name: text().notNull(),
	styleId: text("style_id").notNull(),
	prompt: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "favorite_render_styles_user_id_fkey"
		}),
]);

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

export const meetingMinutes = pgTable("meeting_minutes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id"),
	meetingDate: date("meeting_date").notNull(),
	meetingTitle: text("meeting_title").notNull(),
	meetingType: text("meeting_type").notNull(),
	attendees: text(),
	location: text(),
	filePath: text("file_path").notNull(),
	fileName: text("file_name").notNull(),
	fileType: text("file_type").notNull(),
	fileSize: numeric("file_size"),
	summary: text(),
	uploadedBy: varchar("uploaded_by"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	source: text().default('manual'),
}, (table) => [
	index("idx_meeting_date").using("btree", table.meetingDate.asc().nullsLast().op("date_ops")),
	index("idx_project_id").using("btree", table.projectId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "meeting_minutes_project_id_fkey"
		}),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "meeting_minutes_uploaded_by_fkey"
		}),
]);

export const meetingActionItems = pgTable("meeting_action_items", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	meetingMinutesId: varchar("meeting_minutes_id").notNull(),
	serialNo: integer("serial_no").notNull(),
	issueDiscussed: text("issue_discussed").notNull(),
	responsibility: text(),
	deadline: date(),
	remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_meeting_action_meeting_id").using("btree", table.meetingMinutesId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.meetingMinutesId],
			foreignColumns: [meetingMinutes.id],
			name: "meeting_action_items_meeting_minutes_id_fkey"
		}).onDelete("cascade"),
]);

export const moodboards = pgTable("moodboards", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id"),
	name: text().notNull(),
	description: text(),
	fileName: text("file_name"),
	filePath: text("file_path"),
	fileType: text("file_type"),
	fileSize: numeric("file_size"),
	tags: jsonb(),
	canvaLink: text("canva_link"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
	assetType: text("asset_type").default('moodboard').notNull(),
	roomType: text("room_type"),
	referenceMetadata: jsonb("reference_metadata"),
	savedBy: varchar("saved_by"),
	folder: text(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "moodboards_project_id_fkey"
		}),
	foreignKey({
			columns: [table.savedBy],
			foreignColumns: [users.id],
			name: "moodboards_saved_by_fkey"
		}),
]);

export const objectAssets = pgTable("object_assets", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	objectType: text("object_type").notNull(),
	originalFileName: text("original_file_name").notNull(),
	originalFilePath: text("original_file_path").notNull(),
	processedFilePath: text("processed_file_path"),
	thumbnailPath: text("thumbnail_path"),
	transparentPath: text("transparent_path"),
	processingStatus: text("processing_status").default('pending').notNull(),
	processingError: text("processing_error"),
	detectedBounds: jsonb("detected_bounds"),
	dimensions: jsonb(),
	aiDescription: text("ai_description"),
	aiPromptHints: text("ai_prompt_hints"),
	userDescription: text("user_description"),
	catalogueItemId: varchar("catalogue_item_id"),
	uploadedBy: varchar("uploaded_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	reprocessCount: integer("reprocess_count").default(0).notNull(),
	processingInstructions: text("processing_instructions"),
}, (table) => [
	index("object_assets_status_idx").using("btree", table.processingStatus.asc().nullsLast().op("text_ops")),
	index("object_assets_type_idx").using("btree", table.objectType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.catalogueItemId],
			foreignColumns: [catalogueItems.id],
			name: "object_assets_catalogue_item_id_fkey"
		}),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "object_assets_uploaded_by_fkey"
		}),
]);

export const catalogueItems = pgTable("catalogue_items", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	mainCategory: text("main_category").notNull(),
	subcategory: text().notNull(),
	attributes: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	fileName: text("file_name"),
	filePath: text("file_path"),
	vendorBrand: text("vendor_brand"),
	description: text(),
	catalogueUrl: text("catalogue_url"),
	aiImagePath: text("ai_image_path"),
	aiPromptHints: text("ai_prompt_hints"),
	orgId: varchar("org_id"),
}, (table) => [
	index("catalogue_items_org_id_idx").using("btree", table.orgId.asc().nullsLast().op("text_ops")),
	index("catalogue_main_category_idx").using("btree", table.mainCategory.asc().nullsLast().op("text_ops")),
]);

export const projects = pgTable("projects", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectName: text("project_name").notNull(),
	clientName: text("client_name").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	clientEmail: text("client_email").default(').notNull(),
	canvaLink: text("canva_link"),
	ganttChartLink: text("gantt_chart_link"),
	foyrNeoLink: text("foyr_neo_link"),
	orgId: varchar("org_id"),
}, (table) => [
	index("projects_org_id_idx").using("btree", table.orgId.asc().nullsLast().op("text_ops")),
]);

export const projectClients = pgTable("project_clients", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id").notNull(),
	clientEmail: text("client_email").notNull(),
	clientName: text("client_name"),
	role: text(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("unique_project_client").using("btree", table.projectId.asc().nullsLast().op("text_ops"), table.clientEmail.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_clients_project_id_fkey"
		}).onDelete("cascade"),
]);

export const projectSchedules = pgTable("project_schedules", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id").notNull(),
	fileName: text("file_name").notNull(),
	version: text().default('1.0').notNull(),
	filePath: text("file_path").notNull(),
	fileSize: numeric("file_size"),
	status: text().default('active').notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_schedules_project_id_fkey"
		}),
]);

export const vendorCategories = pgTable("vendor_categories", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	parentId: varchar("parent_id"),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
});

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

export const savedAssets = pgTable("saved_assets", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	displayName: text("display_name").notNull(),
	description: text(),
	tags: text(),
	filePath: text("file_path").notNull(),
	thumbnailPath: text("thumbnail_path"),
	sourceType: text("source_type").default('object_asset').notNull(),
	objectAssetId: varchar("object_asset_id"),
	catalogueItemId: varchar("catalogue_item_id"),
	aiPromptHints: text("ai_prompt_hints"),
	savedBy: varchar("saved_by").notNull(),
	savedAt: timestamp("saved_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("saved_assets_saved_by_idx").using("btree", table.savedBy.asc().nullsLast().op("text_ops")),
	index("saved_assets_source_type_idx").using("btree", table.sourceType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.catalogueItemId],
			foreignColumns: [catalogueItems.id],
			name: "saved_assets_catalogue_item_id_fkey"
		}),
	foreignKey({
			columns: [table.objectAssetId],
			foreignColumns: [objectAssets.id],
			name: "saved_assets_object_asset_id_fkey"
		}),
	foreignKey({
			columns: [table.savedBy],
			foreignColumns: [users.id],
			name: "saved_assets_saved_by_fkey"
		}),
]);

export const taskAlerts = pgTable("task_alerts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	taskId: varchar("task_id").notNull(),
	userId: varchar("user_id").notNull(),
	alertType: text("alert_type").notNull(),
	message: text().notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	triggeredAt: timestamp("triggered_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "task_alerts_task_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "task_alerts_user_id_fkey"
		}),
]);

export const taskDependencies = pgTable("task_dependencies", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	fromTaskId: varchar("from_task_id").notNull(),
	toTaskId: varchar("to_task_id").notNull(),
	dependencyType: text("dependency_type").default('finish_to_start').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	lag: numeric({ precision: 10, scale:  2 }).default('0'),
}, (table) => [
	foreignKey({
			columns: [table.fromTaskId],
			foreignColumns: [tasks.id],
			name: "task_dependencies_from_task_id_fkey"
		}),
	foreignKey({
			columns: [table.toTaskId],
			foreignColumns: [tasks.id],
			name: "task_dependencies_to_task_id_fkey"
		}),
]);

export const userProjectAssignments = pgTable("user_project_assignments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	projectId: varchar("project_id").notNull(),
	assignedBy: varchar("assigned_by"),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("unique_user_project").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.projectId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.assignedBy],
			foreignColumns: [users.id],
			name: "user_project_assignments_assigned_by_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "user_project_assignments_project_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_project_assignments_user_id_fkey"
		}),
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

export const vendorContacts = pgTable("vendor_contacts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	vendorId: varchar("vendor_id").notNull(),
	contactPerson: text("contact_person").notNull(),
	phone: text().notNull(),
	email: text(),
	role: text(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "vendor_contacts_vendor_id_fkey"
		}).onDelete("cascade"),
]);

export const vendorInvoices = pgTable("vendor_invoices", {
	id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
	vendorId: varchar("vendor_id").notNull(),
	projectId: varchar("project_id"),
	invoiceNumber: varchar("invoice_number").notNull(),
	invoiceDate: date("invoice_date").notNull(),
	description: text().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	attachmentPath: text("attachment_path"),
}, (table) => [
	index("idx_vendor_invoices_project_id").using("btree", table.projectId.asc().nullsLast().op("text_ops")),
	index("idx_vendor_invoices_vendor_id").using("btree", table.vendorId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "vendor_invoices_project_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "vendor_invoices_vendor_id_fkey"
		}).onDelete("cascade"),
]);

export const vendorPayments = pgTable("vendor_payments", {
	id: varchar().default((gen_random_uuid())).primaryKey().notNull(),
	vendorId: varchar("vendor_id").notNull(),
	paymentDate: date("payment_date").notNull(),
	paymentReference: varchar("payment_reference").notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	paymentMethod: varchar("payment_method").notNull(),
	notes: text(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	attachmentPath: text("attachment_path"),
}, (table) => [
	index("idx_vendor_payments_vendor_id").using("btree", table.vendorId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [vendors.id],
			name: "vendor_payments_vendor_id_fkey"
		}).onDelete("cascade"),
]);

export const worksOrderDocuments = pgTable("works_order_documents", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	worksOrderId: varchar("works_order_id"),
	documentType: text("document_type").notNull(),
	filePath: text("file_path").notNull(),
	fileName: text("file_name").notNull(),
	fileSize: numeric("file_size", { precision: 15, scale:  0 }),
	isGlobalTemplate: boolean("is_global_template").default(false).notNull(),
	version: text(),
	uploadedBy: varchar("uploaded_by"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("works_order_documents_global_template_idx").using("btree", table.isGlobalTemplate.asc().nullsLast().op("bool_ops")),
	index("works_order_documents_works_order_idx").using("btree", table.worksOrderId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "works_order_documents_uploaded_by_fkey"
		}),
	foreignKey({
			columns: [table.worksOrderId],
			foreignColumns: [worksOrders.id],
			name: "works_order_documents_works_order_id_fkey"
		}).onDelete("cascade"),
]);

export const worksOrders = pgTable("works_orders", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectVendorId: varchar("project_vendor_id").notNull(),
	quoteFileId: varchar("quote_file_id"),
	templateId: varchar("template_id"),
	templateVersion: text("template_version"),
	orderNumber: text("order_number").notNull(),
	title: text().notNull(),
	scope: text().notNull(),
	paymentTerms: text("payment_terms"),
	startDate: date("start_date"),
	completionDate: date("completion_date"),
	totalValue: numeric("total_value", { precision: 15, scale:  2 }),
	status: text().default('draft').notNull(),
	draftFilePath: text("draft_file_path"),
	signedFilePath: text("signed_file_path"),
	accessToken: text("access_token"),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	signedAt: timestamp("signed_at", { mode: 'string' }),
	voidedAt: timestamp("voided_at", { mode: 'string' }),
	voidReason: text("void_reason"),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	notes: text(),
	serialCounter: integer("serial_counter").notNull(),
}, (table) => [
	index("works_orders_order_number_idx").using("btree", table.orderNumber.asc().nullsLast().op("text_ops")),
	index("works_orders_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "works_orders_created_by_fkey"
		}),
	foreignKey({
			columns: [table.projectVendorId],
			foreignColumns: [projectVendors.id],
			name: "works_orders_project_vendor_id_fkey"
		}),
	foreignKey({
			columns: [table.quoteFileId],
			foreignColumns: [quoteFiles.id],
			name: "works_orders_quote_file_id_fkey"
		}),
	unique("works_orders_order_number_unique").on(table.orderNumber),
]);

export const worksOrderFiles = pgTable("works_order_files", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	worksOrderId: varchar("works_order_id").notNull(),
	fileName: text("file_name").notNull(),
	filePath: text("file_path").notNull(),
	fileType: text("file_type").notNull(),
	fileSize: text("file_size").notNull(),
	uploadedBy: varchar("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.worksOrderId],
			foreignColumns: [worksOrders.id],
			name: "works_order_files_works_order_id_fkey"
		}).onDelete("cascade"),
]);

export const worksOrderItems = pgTable("works_order_items", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	worksOrderId: varchar("works_order_id").notNull(),
	description: text().notNull(),
	quantity: numeric({ precision: 15, scale:  2 }).notNull(),
	unit: text().notNull(),
	unitRate: numeric("unit_rate", { precision: 15, scale:  2 }).notNull(),
	totalAmount: numeric("total_amount", { precision: 15, scale:  2 }).notNull(),
	category: text(),
	itemCode: text("item_code"),
	specifications: text(),
	sourceProjectVendorId: varchar("source_project_vendor_id"),
	sourceWorksOrderId: varchar("source_works_order_id"),
	sortOrder: numeric("sort_order", { precision: 10, scale:  0 }).default('0').notNull(),
}, (table) => [
	index("works_order_items_order_sort_idx").using("btree", table.worksOrderId.asc().nullsLast().op("numeric_ops"), table.sortOrder.asc().nullsLast().op("numeric_ops")),
	foreignKey({
			columns: [table.sourceProjectVendorId],
			foreignColumns: [projectVendors.id],
			name: "works_order_items_source_project_vendor_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceWorksOrderId],
			foreignColumns: [worksOrders.id],
			name: "works_order_items_source_works_order_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.worksOrderId],
			foreignColumns: [worksOrders.id],
			name: "works_order_items_works_order_id_fkey"
		}).onDelete("cascade"),
]);

export const worksOrderSignatures = pgTable("works_order_signatures", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	worksOrderId: varchar("works_order_id").notNull(),
	signerId: varchar("signer_id"),
	signerEmail: text("signer_email").notNull(),
	signerName: text("signer_name").notNull(),
	signerRole: text("signer_role").notNull(),
	signatureMethod: text("signature_method").notNull(),
	signatureData: text("signature_data"),
	signaturePath: text("signature_path"),
	ipAddress: text("ip_address"),
	signedAt: timestamp("signed_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.signerId],
			foreignColumns: [users.id],
			name: "works_order_signatures_signer_id_fkey"
		}),
	foreignKey({
			columns: [table.worksOrderId],
			foreignColumns: [worksOrders.id],
			name: "works_order_signatures_works_order_id_fkey"
		}).onDelete("cascade"),
]);

export const worksOrderTemplates = pgTable("works_order_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	categoryId: varchar("category_id"),
	description: text(),
	objectPath: text("object_path").notNull(),
	originalFileName: text("original_file_name").notNull(),
	mimeType: text("mime_type"),
	fileSize: integer("file_size"),
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("works_order_templates_category_idx").using("btree", table.categoryId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [vendorCategories.id],
			name: "works_order_templates_category_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "works_order_templates_created_by_fkey"
		}),
]);

export const tasks = pgTable("tasks", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	projectId: varchar("project_id").notNull(),
	name: text().notNull(),
	description: text(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	duration: numeric({ precision: 10, scale:  2 }),
	assignedTo: varchar("assigned_to"),
	status: text().default('not_started').notNull(),
	progressPercentage: numeric("progress_percentage", { precision: 5, scale:  2 }).default('0'),
	predecessorIds: text("predecessor_ids").array(),
	approvalRequired: boolean("approval_required").default(false).notNull(),
	approvalStatus: text("approval_status"),
	approvedBy: varchar("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	priority: text().default('medium').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	scheduleId: varchar("schedule_id"),
	taskId: text("task_id"),
	isCriticalPath: boolean("is_critical_path").default(false).notNull(),
	materials: text(),
	owner: text(),
	targetStartDate: date("target_start_date"),
	targetEndDate: date("target_end_date"),
	remarks: text(),
	outlineLevel: integer("outline_level"),
	color: text(),
	rowIndex: integer("row_index"),
	subcategory: text(),
	deadlineHistory: jsonb("deadline_history").default([]),
}, (table) => [
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "tasks_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "tasks_assigned_to_fkey"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "tasks_project_id_fkey"
		}),
	foreignKey({
			columns: [table.scheduleId],
			foreignColumns: [projectSchedules.id],
			name: "tasks_schedule_id_fkey"
		}),
]);

export const sops = pgTable("sops", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	title: text().notNull(),
	category: text().notNull(),
	description: text(),
	content: text(),
	fileName: text("file_name"),
	filePath: text("file_path"),
	createdBy: varchar("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sops_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "sops_created_by_fkey"
		}),
]);

export const invitations = pgTable("invitations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	orgId: varchar("org_id").notNull(),
	email: text().notNull(),
	role: text().default('designer').notNull(),
	token: varchar().notNull(),
	invitedBy: varchar("invited_by").notNull(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("invitations_token_key").on(table.token),
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
	passwordHash: varchar("password_hash"),
	emailVerifiedAt: timestamp("email_verified_at", { mode: 'string' }),
	emailVerificationToken: varchar("email_verification_token"),
	passwordResetToken: varchar("password_reset_token"),
	passwordResetTokenExpiry: timestamp("password_reset_token_expiry", { mode: 'string' }),
	orgId: varchar("org_id"),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: 'string' }),
	isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
	notificationPreferences: jsonb("notification_preferences"),
	unsubscribeToken: varchar("unsubscribe_token"),
	trialBannerSnoozedUntil: timestamp("trial_banner_snoozed_until", { mode: 'string' }),
	trialBannerSnoozeDuration: text("trial_banner_snooze_duration"),
}, (table) => [
	unique("users_username_unique").on(table.email),
	unique("users_email_verification_token_key").on(table.emailVerificationToken),
	unique("users_password_reset_token_key").on(table.passwordResetToken),
	unique("users_unsubscribe_token_key").on(table.unsubscribeToken),
]);

export const superadminAuditLog = pgTable("superadmin_audit_log", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	superAdminId: varchar("super_admin_id"),
	action: text().notNull(),
	targetOrgId: varchar("target_org_id"),
	targetUserId: varchar("target_user_id"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("superadmin_audit_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("superadmin_audit_super_admin_idx").using("btree", table.superAdminId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.superAdminId],
			foreignColumns: [users.id],
			name: "superadmin_audit_log_super_admin_id_fkey"
		}),
	foreignKey({
			columns: [table.targetOrgId],
			foreignColumns: [organisations.id],
			name: "superadmin_audit_log_target_org_id_fkey"
		}),
	foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [users.id],
			name: "superadmin_audit_log_target_user_id_fkey"
		}),
]);

export const organisations = pgTable("organisations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	slug: varchar().notNull(),
	plan: text().default('trial').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	planStatus: text("plan_status").default('trialing').notNull(),
	currentPeriodEnd: timestamp("current_period_end", { mode: 'string' }),
	trialExpiryNotifiedAt: timestamp("trial_expiry_notified_at", { mode: 'string' }),
}, (table) => [
	unique("organisations_slug_key").on(table.slug),
]);
