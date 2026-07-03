import { TRIAL_DURATION_DAYS } from "./config";
import { 
  type User, 
  type UpsertUser,
  type NotificationPreferences,
  parseNotificationPreferences,
  type UserRole,
  type InsertUserRole,
  type UserProjectAssignment,
  type InsertUserProjectAssignment,
  type DesignerAllowlist,
  type InsertDesignerAllowlist,
  type Organisation,
  type InsertOrganisation,
  type Invitation,
  type InsertInvitation,
  type SuperadminAuditLog,
  type InsertSuperadminAuditLog,
  type VendorCategory,
  type InsertVendorCategory,
  type Vendor,
  type InsertVendor,
  type VendorContact,
  type InsertVendorContact,
  type Project,
  type InsertProject,
  type ProjectClient,
  type InsertProjectClient,
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
  type ActivityLog,
  type InsertActivityLog,
  type VendorInvoice,
  type InsertVendorInvoice,
  type VendorPayment,
  type InsertVendorPayment,
  type CatalogueItem,
  type InsertCatalogueItem,
  type ObjectAsset,
  type InsertObjectAsset,
  type Specification,
  type InsertSpecification,
  type SavedAsset,
  type InsertSavedAsset,
  type MeetingMinutes,
  type InsertMeetingMinutes,
  type MeetingActionItem,
  type InsertMeetingActionItem,
  type WorksOrderTemplate,
  type InsertWorksOrderTemplate,
  type WorksOrder,
  type InsertWorksOrder,
  type WorksOrderSignature,
  type InsertWorksOrderSignature,
  type WorksOrderItem,
  type InsertWorksOrderItem,
  superadminAuditLog,
  organisations,
  invitations,
  users,
  userRoles,
  userProjectAssignments,
  designerAllowlist,
  vendorCategories,
  vendors,
  vendorContacts,
  projects,
  projectClients,
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
  activityLog,
  vendorInvoices,
  vendorPayments,
  catalogueItems,
  objectAssets,
  specifications,
  savedAssets,
  meetingMinutes,
  meetingActionItems,
  worksOrderTemplates,
  worksOrders,
  worksOrderSignatures,
  worksOrderItems,
  worksOrderFiles,
  sops,
  type InsertSop,
  type Sop,
  projectCostItems,
  type InsertProjectCostItem,
  type ProjectCostItem,
  rooms,
  drawings,
  drawingRevisions,
  type Room,
  type Drawing,
  type DrawingRevision,
  handoverItems,
  type HandoverItem,
  type InsertHandoverItem,
  paymentRequests,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, inArray, isNull, and, or, desc, sql, asc, getTableColumns, gt, ne } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByOrg(orgId: string): Promise<User[]>;
  upsertUser(userData: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  setEmailVerificationToken(userId: string, token: string): Promise<void>;
  setPasswordResetToken(userId: string, token: string, expiry: Date): Promise<void>;
  resetPassword(userId: string, passwordHash: string): Promise<void>;
  verifyEmail(token: string): Promise<User | undefined>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; notificationEmail?: string | null }): Promise<User>;
  getUserByUnsubscribeToken(token: string): Promise<User | undefined>;
  getOrCreateUnsubscribeToken(userId: string): Promise<string>;
  updateTrialBannerSnooze(userId: string, snoozedUntil: Date | null, snoozeDuration?: string | null): Promise<void>;
  getTrialBannerSnooze(userId: string): Promise<{ snoozedUntil: Date | null; snoozeDuration: string | null }>;
  removeUserFromOrg(userId: string): Promise<void>;
  
  // User Project Access (for client role project assignment)
  createUserProjectAccess(access: { userId: string; projectId: string }): Promise<{ userId: string; projectId: string }>;
  deleteUserProjectAccess(userId: string, projectId: string): Promise<boolean>;
  
  // User Roles - for role-based access control
  getUserRole(userId: string): Promise<UserRole | undefined>;
  createUserRole(userRole: InsertUserRole): Promise<UserRole>;
  updateUserRole(userId: string, role: string): Promise<UserRole | undefined>;
  setUserRoleLinkedVendor(userId: string, linkedVendorId: string | null): Promise<void>;
  
  // User Project Assignments - for project managers
  getUserProjectAssignments(userId: string): Promise<UserProjectAssignment[]>;
  getAllUserProjectAssignments(): Promise<UserProjectAssignment[]>;
  assignUserToProject(assignment: InsertUserProjectAssignment): Promise<UserProjectAssignment>;
  removeUserFromProject(userId: string, projectId: string): Promise<boolean>;
  getUsersAssignedToProject(projectId: string): Promise<UserProjectAssignment[]>;
  
  // Organisations
  createOrganisation(org: InsertOrganisation): Promise<Organisation>;
  getOrganisation(id: string): Promise<Organisation | undefined>;
  getOrganisationBySlug(slug: string): Promise<Organisation | undefined>;
  getOrganisationByStripeCustomerId(customerId: string): Promise<Organisation | undefined>;
  updateOrganisation(id: string, updates: Partial<InsertOrganisation>): Promise<Organisation | undefined>;
  getOrgsNearTrialExpiry(withinDays: number, notifiedWithinDays: number): Promise<Organisation[]>;
  markOrgTrialExpiryNotified(orgId: string, notifiedAt: Date): Promise<void>;

  // Invitations
  createInvitation(inv: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationsByOrg(orgId: string): Promise<Invitation[]>;
  revokeInvitation(id: string): Promise<boolean>;
  acceptInvitation(token: string): Promise<Invitation | undefined>;
  updateInvitationToken(id: string, token: string, expiresAt: Date): Promise<Invitation | undefined>;

  // Atomic org + admin registration (single transaction)
  registerOrgWithAdmin(params: {
    orgName: string;
    slug: string;
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    passwordHash: string;
    verificationToken: string;
  }): Promise<{ org: Organisation; user: User }>;

  // User onboarding
  completeOnboarding(userId: string): Promise<void>;
  setUserOrgId(userId: string, orgId: string): Promise<void>;

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
  getVendorsByIds(ids: string[]): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  getVendorsByCategory(categoryId: string): Promise<Vendor[]>;
  getVendorsByCategoryWithDescendants(categoryId: string): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;
  
  // Vendor Contacts
  getVendorContacts(vendorId: string): Promise<VendorContact[]>;
  getVendorContact(id: string): Promise<VendorContact | undefined>;
  createVendorContact(contact: InsertVendorContact): Promise<VendorContact>;
  updateVendorContact(id: string, contact: Partial<InsertVendorContact>): Promise<VendorContact | undefined>;
  deleteVendorContact(id: string): Promise<boolean>;
  
  // Projects
  getAllProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Project Clients
  getProjectClients(projectId: string): Promise<ProjectClient[]>;
  addProjectClient(client: InsertProjectClient): Promise<ProjectClient>;
  removeProjectClient(id: string): Promise<boolean>;
  getManagerProjectsByEmail(email: string): Promise<ProjectClient[]>;
  getProjectsByClientEmail(clientEmail: string): Promise<Project[]>;
  
  // Project Vendors
  getAllProjectVendors(): Promise<ProjectVendor[]>;
  getProjectVendors(projectId: string): Promise<ProjectVendor[]>;
  getProjectVendor(id: string): Promise<ProjectVendor | undefined>;
  createProjectVendor(projectVendor: InsertProjectVendor): Promise<ProjectVendor>;
  upsertProjectVendor(projectVendor: InsertProjectVendor): Promise<ProjectVendor>;
  updateProjectVendor(id: string, projectVendor: Partial<InsertProjectVendor>): Promise<ProjectVendor | undefined>;
  deleteProjectVendor(id: string): Promise<boolean>;
  getProjectCategoriesWithQuotes(projectId: string): Promise<Array<{ category: string; quotesCount: number }>>;
  getProjectQuotesByCategory(projectId: string, category: string): Promise<Array<ProjectVendor & { vendorName: string }>>;
  
  // Quote Templates
  getAllQuoteTemplates(orgId?: string | null): Promise<QuoteTemplate[]>;
  getQuoteTemplate(id: string): Promise<QuoteTemplate | undefined>;
  getQuoteTemplateWithFileData(id: string): Promise<QuoteTemplate | undefined>;
  getQuoteTemplatesByCategory(categoryId: string): Promise<QuoteTemplate[]>;
  createQuoteTemplate(template: InsertQuoteTemplate): Promise<QuoteTemplate>;
  updateQuoteTemplate(id: string, template: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate | undefined>;
  deleteQuoteTemplate(id: string): Promise<boolean>;
  
  // BOQ (Bill of Quantities)
  getBOQByProjectVendor(projectVendorId: string): Promise<Boq[]>;
  getBOQBulkByProjectVendors(projectVendorIds: string[]): Promise<Boq[]>;
  getQuoteFilesBulkByProjectVendors(projectVendorIds: string[]): Promise<QuoteFile[]>;
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
  getMoodboardsForUser(userId: string, role: string, projectId?: string, assetType?: string, orgId?: string | null): Promise<Moodboard[]>;
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
  getAllTasks(orgId?: string): Promise<Task[]>;
  getAllTasksByProjectIds(projectIds: string[]): Promise<Task[]>;
  getTasksByProject(projectId: string): Promise<Task[]>;
  getTasksBySchedule(scheduleId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask & { createdAt?: Date }): Promise<Task>;
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
  
  // Activity Log
  getRecentActivities(limit?: number, projectId?: string): Promise<ActivityLog[]>;
  getRecentActivitiesByOrg(orgId: string, limit?: number): Promise<ActivityLog[]>;
  createActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  
  // Vendor Invoices
  getVendorInvoices(vendorId: string): Promise<VendorInvoice[]>;
  getVendorInvoice(id: string): Promise<VendorInvoice | undefined>;
  createVendorInvoice(invoice: InsertVendorInvoice): Promise<VendorInvoice>;
  updateVendorInvoice(id: string, invoice: Partial<InsertVendorInvoice>): Promise<VendorInvoice | undefined>;
  deleteVendorInvoice(id: string): Promise<boolean>;
  
  // Vendor Payments
  getVendorPayments(vendorId: string): Promise<VendorPayment[]>;
  getAllPaymentsWithVendors(): Promise<Array<VendorPayment & { vendorName: string }>>;
  getVendorPayment(id: string): Promise<VendorPayment | undefined>;
  createVendorPayment(payment: InsertVendorPayment): Promise<VendorPayment>;
  updateVendorPayment(id: string, payment: Partial<InsertVendorPayment>): Promise<VendorPayment | undefined>;
  deleteVendorPayment(id: string): Promise<boolean>;
  /** Returns null for admin (unrestricted). For others: Set of vendor IDs linked to accessible projects; vendors with no project links are included. */
  getAccessibleVendorIds(userId: string, role: string): Promise<Set<string> | null>;
  
  // Catalogue Items
  getAllCatalogueItems(orgId?: string | null): Promise<CatalogueItem[]>;
  getCatalogueItem(id: string): Promise<CatalogueItem | undefined>;
  getMainCategories(orgId?: string | null): Promise<string[]>;
  getCategoriesWithImageCounts(orgId?: string | null): Promise<{ category: string; imageCount: number }[]>;
  getCatalogueItemsByCategory(mainCategory?: string, subcategory?: string, orgId?: string | null): Promise<CatalogueItem[]>;
  getCatalogueItemsCount(orgId?: string | null): Promise<number>;
  createCatalogueItem(item: InsertCatalogueItem): Promise<CatalogueItem>;
  createCatalogueItemWithId(item: InsertCatalogueItem & { id: string }): Promise<CatalogueItem>;
  updateCatalogueItem(id: string, item: Partial<InsertCatalogueItem>): Promise<CatalogueItem | undefined>;
  deleteCatalogueItem(id: string): Promise<boolean>;
  
  // Specifications
  getAllSpecifications(orgId?: string | null): Promise<Specification[]>;
  getSpecification(id: string): Promise<Specification | undefined>;
  getSpecificationsByCategory(category: string, orgId?: string | null): Promise<Specification[]>;
  getSpecificationCategories(orgId?: string | null): Promise<string[]>;
  createSpecification(spec: InsertSpecification): Promise<Specification>;
  updateSpecification(id: string, spec: Partial<InsertSpecification>): Promise<Specification | undefined>;
  deleteSpecification(id: string): Promise<boolean>;

  // SOPs
  getAllSops(orgId?: string | null): Promise<Sop[]>;
  getSop(id: string): Promise<Sop | undefined>;
  getSopsByCategory(category: string, orgId?: string | null): Promise<Sop[]>;
  getSopCategories(orgId?: string | null): Promise<string[]>;
  createSop(sop: InsertSop): Promise<Sop>;
  updateSop(id: string, sop: Partial<InsertSop>): Promise<Sop | undefined>;
  deleteSop(id: string): Promise<boolean>;

  // Project Cost Items
  getProjectCostItems(projectId: string): Promise<ProjectCostItem[]>;
  createProjectCostItem(item: InsertProjectCostItem): Promise<ProjectCostItem>;
  updateProjectCostItem(id: string, item: Partial<InsertProjectCostItem>): Promise<ProjectCostItem | undefined>;
  deleteProjectCostItem(id: string): Promise<boolean>;

  // Accessories Checklist (Handover Items)
  getHandoverItems(orgId: string): Promise<HandoverItem[]>;
  createHandoverItem(item: InsertHandoverItem): Promise<HandoverItem>;
  updateHandoverItem(id: string, orgId: string, updates: Partial<InsertHandoverItem>): Promise<HandoverItem | undefined>;
  deleteHandoverItem(id: string, orgId: string): Promise<boolean>;
  bulkCreateHandoverItems(items: InsertHandoverItem[]): Promise<HandoverItem[]>;

  // Saved Assets
  getAllSavedAssets(orgId?: string | null): Promise<SavedAsset[]>;
  getSavedAsset(id: string): Promise<SavedAsset | undefined>;
  getSavedAssetsByUser(userId: string): Promise<SavedAsset[]>;
  createSavedAsset(asset: InsertSavedAsset): Promise<SavedAsset>;
  updateSavedAsset(id: string, asset: Partial<InsertSavedAsset>): Promise<SavedAsset | undefined>;
  deleteSavedAsset(id: string): Promise<boolean>;
  
  // Meeting Minutes
  getAllMeetingMinutes(orgId?: string | null): Promise<MeetingMinutes[]>;
  getMeetingMinutes(id: string): Promise<MeetingMinutes | undefined>;
  getMeetingMinutesByProject(projectId: string, orgId?: string | null): Promise<MeetingMinutes[]>;
  getMeetingMinutesByDateRange(startDate: string, endDate: string, orgId?: string | null): Promise<MeetingMinutes[]>;
  createMeetingMinutes(minutes: InsertMeetingMinutes): Promise<MeetingMinutes>;
  updateMeetingMinutes(id: string, minutes: Partial<InsertMeetingMinutes>): Promise<MeetingMinutes | undefined>;
  deleteMeetingMinutes(id: string): Promise<boolean>;
  
  // Meeting Action Items
  getMeetingActionItems(meetingMinutesId: string): Promise<MeetingActionItem[]>;
  createMeetingActionItem(item: InsertMeetingActionItem): Promise<MeetingActionItem>;
  deleteMeetingActionItems(meetingMinutesId: string): Promise<boolean>;
  
  // Works Order Templates
  getAllWorksOrderTemplates(): Promise<WorksOrderTemplate[]>;
  getWorksOrderTemplate(id: string): Promise<WorksOrderTemplate | undefined>;
  getActiveWorksOrderTemplates(): Promise<WorksOrderTemplate[]>;
  getWorksOrderTemplatesForUser(userId: string, role: string): Promise<WorksOrderTemplate[]>;
  createWorksOrderTemplate(template: InsertWorksOrderTemplate): Promise<WorksOrderTemplate>;
  updateWorksOrderTemplate(id: string, updates: Partial<InsertWorksOrderTemplate>): Promise<WorksOrderTemplate | undefined>;
  deleteWorksOrderTemplate(id: string): Promise<boolean>;
  
  // Works Orders
  getAllWorksOrders(): Promise<WorksOrder[]>;
  getWorksOrder(id: string): Promise<WorksOrder | undefined>;
  getWorksOrderWithRelations(id: string): Promise<WorksOrder & { projectName?: string; clientName?: string; vendorName?: string; templateName?: string } | undefined>;
  getWorksOrdersByProject(projectId: string): Promise<WorksOrder[]>;
  getWorksOrdersByProjectVendor(projectVendorId: string): Promise<WorksOrder[]>;
  getWorksOrdersForUser(userId: string, role: string, projectId?: string): Promise<WorksOrder[]>;
  getWorksOrderByToken(token: string): Promise<WorksOrder | undefined>;
  createWorksOrder(order: InsertWorksOrder): Promise<WorksOrder>;
  updateWorksOrder(id: string, updates: Partial<InsertWorksOrder>): Promise<WorksOrder | undefined>;
  updateWorksOrderStatus(id: string, status: string, metadata?: { sentAt?: Date; signedAt?: Date; voidedAt?: Date; voidReason?: string; signedFilePath?: string }): Promise<WorksOrder | undefined>;
  deleteWorksOrder(id: string): Promise<boolean>;
  generateOrderNumber(): Promise<string>;
  
  // Works Order Signatures
  getSignaturesByWorksOrder(worksOrderId: string): Promise<WorksOrderSignature[]>;
  getSignatureByOrderAndEmail(worksOrderId: string, email: string): Promise<WorksOrderSignature | undefined>;
  createSignature(signature: InsertWorksOrderSignature): Promise<WorksOrderSignature>;
  
  // Works Order Items
  getWorksOrderItems(worksOrderId: string): Promise<WorksOrderItem[]>;
  createWorksOrderItem(item: InsertWorksOrderItem): Promise<WorksOrderItem>;
  createWorksOrderItemsBatch(items: InsertWorksOrderItem[]): Promise<WorksOrderItem[]>;
  updateWorksOrderItem(id: string, updates: Partial<InsertWorksOrderItem>): Promise<WorksOrderItem | undefined>;
  deleteWorksOrderItem(id: string): Promise<boolean>;
  deleteWorksOrderItemsByOrder(worksOrderId: string): Promise<boolean>;
  replaceWorksOrderItems(worksOrderId: string, items: InsertWorksOrderItem[]): Promise<WorksOrderItem[]>;
  
  // Vendors (with role-based filtering)
  getVendorsForUser(userId: string, role: string): Promise<Vendor[]>;
  getProjectVendorsForUser(userId: string, role: string): Promise<ProjectVendor[]>;
  
  // Usage tracking (for plan limit enforcement)
  getOrgUsage(orgId: string): Promise<{ projects: number; users: number; catalogueItems: number; storageGb: number }>;

  // Super-admin back-office
  getAllOrganisationsWithStats(): Promise<Array<Organisation & { userCount: number; projectCount: number; lastActivityAt: string | null; storageGb: number }>>;
  writeSuperAdminAuditLog(entry: InsertSuperadminAuditLog): Promise<SuperadminAuditLog>;
  getSuperAdminAuditLogs(limit?: number): Promise<SuperadminAuditLog[]>;
  setUserSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<void>;

  // Object Assets (photo processing for art, furniture, etc.)
  getAllObjectAssets(): Promise<ObjectAsset[]>;
  getObjectAsset(id: string): Promise<ObjectAsset | undefined>;
  getObjectAssetsByType(objectType: string): Promise<ObjectAsset[]>;
  getObjectAssetsByStatus(status: string): Promise<ObjectAsset[]>;
  getObjectAssetsByUser(userId: string): Promise<ObjectAsset[]>;
  createObjectAsset(asset: InsertObjectAsset): Promise<ObjectAsset>;
  updateObjectAsset(id: string, updates: Partial<InsertObjectAsset>): Promise<ObjectAsset | undefined>;
  updateObjectAssetProcessing(id: string, updates: {
    processingStatus: string;
    processedFilePath?: string;
    thumbnailPath?: string;
    transparentPath?: string;
    detectedBounds?: any;
    dimensions?: any;
    aiDescription?: string;
    aiPromptHints?: string;
    processingError?: string;
    processedAt?: Date;
    reprocessCount?: number;
  }): Promise<ObjectAsset | undefined>;
  deleteObjectAsset(id: string): Promise<boolean>;
  linkAssetToCatalogue(assetId: string, catalogueItemId: string): Promise<ObjectAsset | undefined>;

  // Working Drawings
  getRoomsForProject(orgId: string, projectId: string): Promise<Array<Room & { drawingCount: number }>>;
  getDrawingsForProject(orgId: string | null, projectId: string, search?: string, drawingType?: string): Promise<Array<Drawing & { latestRevision: DrawingRevision | null; room: Room | null }>>;
  createRoom(orgId: string, projectId: string, data: { name: string; roomType: string }): Promise<Room>;
  updateRoom(id: string, orgId: string, data: { name: string; roomType: string }): Promise<Room | undefined>;
  deleteRoom(id: string, orgId: string, projectId: string): Promise<{ success: boolean; drawingCount: number }>;
  updateDrawing(id: string, orgId: string, data: { title?: string; roomId?: string | null; category?: string }): Promise<Drawing | undefined>;
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

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByOrg(orgId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => (u as any).orgId === orgId);
  }

  async removeUserFromOrg(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      (user as any).orgId = null;
      this.users.set(userId, user);
    }
    const role = this.userRoles.get(userId);
    if (role) {
      role.isActive = false;
      this.userRoles.set(userId, role);
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id!);
    if (existingUser) {
      const updatedUser: User = { ...existingUser, ...userData, updatedAt: new Date() };
      this.users.set(existingUser.id, updatedUser);
      return updatedUser;
    } else {
      const id = userData.id || randomUUID();
      const user: User = {
        id,
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        passwordHash: userData.passwordHash || null,
        emailVerifiedAt: userData.emailVerifiedAt || null,
        emailVerificationToken: userData.emailVerificationToken || null,
        passwordResetToken: userData.passwordResetToken || null,
        passwordResetTokenExpiry: userData.passwordResetTokenExpiry || null,
        orgId: userData.orgId ?? null,
        onboardingCompletedAt: userData.onboardingCompletedAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(id, user);
      return user;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email?.toLowerCase() === email.toLowerCase());
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.passwordResetToken === token);
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
      this.users.set(userId, user);
    }
  }

  async setEmailVerificationToken(userId: string, token: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.emailVerificationToken = token;
      user.emailVerifiedAt = null;
      user.updatedAt = new Date();
      this.users.set(userId, user);
    }
  }

  async setPasswordResetToken(userId: string, token: string, expiry: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordResetToken = token;
      user.passwordResetTokenExpiry = expiry;
      this.users.set(userId, user);
    }
  }

  async resetPassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
      user.passwordResetToken = null;
      user.passwordResetTokenExpiry = null;
      user.emailVerificationToken = null;  // reset counts as verification
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
      user.updatedAt = new Date();
      this.users.set(userId, user);
    }
  }

  async verifyEmail(token: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(u => u.emailVerificationToken === token);
    if (user) {
      user.emailVerifiedAt = new Date();
      user.emailVerificationToken = null;
      this.users.set(user.id, user);
      return user;
    }
    return undefined;
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
      orgId: userRole.orgId ?? null,
      role: userRole.role || "client",
      isActive: userRole.isActive ?? true,
      assignedAt: new Date(),
      assignedBy: userRole.assignedBy ?? null,
      createdAt: userRole.createdAt ?? null,
      updatedAt: userRole.updatedAt ?? null,
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

  async setUserRoleLinkedVendor(userId: string, linkedVendorId: string | null): Promise<void> {
    const existingRole = await this.getUserRole(userId);
    if (existingRole) {
      (existingRole as any).linkedVendorId = linkedVendorId;
      this.userRoles.set(existingRole.id, existingRole);
    }
  }

  // User Project Assignments - for project manager role (MemStorage stubs)
  async getUserProjectAssignments(userId: string): Promise<UserProjectAssignment[]> {
    // Stub implementation for MemStorage
    return [];
  }

  async getAllUserProjectAssignments(): Promise<UserProjectAssignment[]> {
    // Stub implementation for MemStorage
    return [];
  }

  async assignUserToProject(assignment: InsertUserProjectAssignment): Promise<UserProjectAssignment> {
    // Stub implementation for MemStorage
    const result: UserProjectAssignment = {
      id: randomUUID(),
      orgId: assignment.orgId ?? null,
      userId: assignment.userId,
      projectId: assignment.projectId,
      assignedBy: assignment.assignedBy || null,
      assignedAt: new Date(),
    };
    return result;
  }

  async removeUserFromProject(userId: string, projectId: string): Promise<boolean> {
    // Stub implementation for MemStorage
    return true;
  }

  async getUsersAssignedToProject(projectId: string): Promise<UserProjectAssignment[]> {
    // Stub implementation for MemStorage
    return [];
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

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const user = this.users.get(userId);
    return parseNotificationPreferences((user as any)?.notificationPreferences);
  }

  async updateNotificationPreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    const current = parseNotificationPreferences((user as any).notificationPreferences);
    const updated = { ...current, ...prefs };
    (user as any).notificationPreferences = updated;
    (user as any).updatedAt = new Date();
    this.users.set(userId, user);
    return updated;
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; notificationEmail?: string | null }): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    if (data.firstName !== undefined) (user as any).firstName = data.firstName;
    if (data.lastName !== undefined) (user as any).lastName = data.lastName;
    if (data.notificationEmail !== undefined) (user as any).notificationEmail = data.notificationEmail;
    (user as any).updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async getUserByUnsubscribeToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => (u as any).unsubscribeToken === token);
  }

  async updateTrialBannerSnooze(userId: string, snoozedUntil: Date | null, snoozeDuration?: string | null): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    (user as any).trialBannerSnoozedUntil = snoozedUntil;
    (user as any).trialBannerSnoozeDuration = snoozeDuration ?? null;
    (user as any).updatedAt = new Date();
    this.users.set(userId, user);
  }

  async getTrialBannerSnooze(userId: string): Promise<{ snoozedUntil: Date | null; snoozeDuration: string | null }> {
    const user = this.users.get(userId);
    if (!user) return { snoozedUntil: null, snoozeDuration: null };
    return {
      snoozedUntil: (user as any).trialBannerSnoozedUntil ?? null,
      snoozeDuration: (user as any).trialBannerSnoozeDuration ?? null,
    };
  }

  async getOrCreateUnsubscribeToken(userId: string): Promise<string> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    if ((user as any).unsubscribeToken) return (user as any).unsubscribeToken;
    const { randomUUID } = await import("crypto");
    const token = randomUUID();
    (user as any).unsubscribeToken = token;
    (user as any).updatedAt = new Date();
    this.users.set(userId, user);
    return token;
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
      orgId: insertCategory.orgId ?? null,
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

  async getVendorsByIds(ids: string[]): Promise<Vendor[]> {
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    return Array.from(this.vendors.values()).filter(v => idSet.has(v.id));
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
      orgId: insertVendor.orgId ?? null,
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
      orgId: insertProject.orgId ?? null,
      endDate: insertProject.endDate || null,
      canvaLink: insertProject.canvaLink ?? null,
      ganttChartLink: insertProject.ganttChartLink ?? null,
      foyrNeoLink: insertProject.foyrNeoLink ?? null,
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

  // Project Clients
  async getProjectClients(projectId: string): Promise<ProjectClient[]> {
    return []; // Not implemented in MemStorage - using DBStorage
  }

  async addProjectClient(client: InsertProjectClient): Promise<ProjectClient> {
    throw new Error("Not implemented in MemStorage - using DBStorage");
  }

  async removeProjectClient(id: string): Promise<boolean> {
    return false; // Not implemented in MemStorage - using DBStorage
  }

  async getManagerProjectsByEmail(email: string): Promise<ProjectClient[]> {
    return []; // Not implemented in MemStorage - using DBStorage
  }

  async getProjectsByClientEmail(clientEmail: string): Promise<Project[]> {
    // Not fully implemented in MemStorage - using DBStorage
    // Fallback to old method for compatibility
    return Array.from(this.projects.values()).filter(p => p.clientEmail === clientEmail);
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
      orgId: insertProjectVendor.orgId ?? null,
      quotationName: insertProjectVendor.quotationName || "Main Quote",
      quotationType: insertProjectVendor.quotationType || "item",
      parentQuotationId: insertProjectVendor.parentQuotationId || null,
      itemCategory: insertProjectVendor.itemCategory || null,
      quotationFile: insertProjectVendor.quotationFile || null,
      quotationValue: insertProjectVendor.quotationValue || null,
      dateOfQuotation: insertProjectVendor.dateOfQuotation || null,
      notes: insertProjectVendor.notes || null,
      templateId: insertProjectVendor.templateId || null,
      unitRateSubtype: insertProjectVendor.unitRateSubtype ?? null,
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
  async getAllQuoteTemplates(orgId?: string | null): Promise<QuoteTemplate[]> {
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
      orgId: insertTemplate.orgId ?? null,
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

  async getBOQBulkByProjectVendors(projectVendorIds: string[]): Promise<Boq[]> {
    if (projectVendorIds.length === 0) return [];
    const idSet = new Set(projectVendorIds);
    return Array.from(this.boq.values()).filter(b => idSet.has(b.projectVendorId));
  }

  async getQuoteFilesBulkByProjectVendors(projectVendorIds: string[]): Promise<QuoteFile[]> {
    if (projectVendorIds.length === 0) return [];
    const idSet = new Set(projectVendorIds);
    return Array.from(this.quoteFiles.values()).filter(f => idSet.has(f.projectVendorId));
  }

  async getBOQ(id: string): Promise<Boq | undefined> {
    return this.boq.get(id);
  }

  async createBOQ(insertBoq: InsertBoq): Promise<Boq> {
    const id = randomUUID();
    const boq: Boq = { 
      ...insertBoq, 
      id,
      orgId: insertBoq.orgId ?? null,
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
      orgId: insertQuoteFile.orgId ?? null,
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
      orgId: insertFloorPlan.orgId ?? null,
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

  async getMoodboardsForUser(userId: string, role: string, projectId?: string, assetType?: string, orgId?: string | null): Promise<Moodboard[]> {
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
  async getAllTasks(_orgId?: string): Promise<Task[]> {
    return [];
  }

  async getAllTasksByProjectIds(_projectIds: string[]): Promise<Task[]> {
    return [];
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return [];
  }

  async getTasksBySchedule(scheduleId: string): Promise<Task[]> {
    return [];
  }

  async getTask(id: string): Promise<Task | undefined> {
    return undefined;
  }

  async createTask(task: InsertTask & { createdAt?: Date }): Promise<Task> {
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

  // Activity Log (MemStorage stubs)
  async getRecentActivities(limit?: number, projectId?: string): Promise<ActivityLog[]> {
    return [];
  }

  async getRecentActivitiesByOrg(_orgId: string, _limit?: number): Promise<ActivityLog[]> {
    return [];
  }

  async createActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    throw new Error("MemStorage not supported for activity log");
  }

  // Vendor Invoices (stub for MemStorage)
  async getVendorInvoices(vendorId: string): Promise<VendorInvoice[]> {
    return [];
  }

  async getVendorInvoice(id: string): Promise<VendorInvoice | undefined> {
    return undefined;
  }

  async createVendorInvoice(invoice: InsertVendorInvoice): Promise<VendorInvoice> {
    throw new Error("MemStorage not supported for vendor invoices");
  }

  async updateVendorInvoice(id: string, invoice: Partial<InsertVendorInvoice>): Promise<VendorInvoice | undefined> {
    return undefined;
  }

  async deleteVendorInvoice(id: string): Promise<boolean> {
    return false;
  }

  // Vendor Payments (stub for MemStorage)
  async getVendorPayments(vendorId: string): Promise<VendorPayment[]> {
    return [];
  }

  async getAllPaymentsWithVendors(): Promise<Array<VendorPayment & { vendorName: string }>> {
    return [];
  }

  async getVendorPayment(id: string): Promise<VendorPayment | undefined> {
    return undefined;
  }

  async createVendorPayment(payment: InsertVendorPayment): Promise<VendorPayment> {
    throw new Error("MemStorage not supported for vendor payments");
  }

  async updateVendorPayment(id: string, payment: Partial<InsertVendorPayment>): Promise<VendorPayment | undefined> {
    return undefined;
  }

  async deleteVendorPayment(id: string): Promise<boolean> {
    return false;
  }

  async getAccessibleVendorIds(_userId: string, _role: string): Promise<Set<string> | null> {
    return null; // MemStorage: no restrictions
  }

  async getVendorsForUser(userId: string, role: string): Promise<Vendor[]> {
    // ALL authenticated users can access all vendors
    return this.getAllVendors();
  }

  // ── Organisations & Invitations (MemStorage stubs — not used in prod) ──
  async createOrganisation(org: InsertOrganisation): Promise<Organisation> {
    throw new Error("MemStorage: createOrganisation not supported");
  }
  async getOrganisation(id: string): Promise<Organisation | undefined> { return undefined; }
  async getOrganisationBySlug(slug: string): Promise<Organisation | undefined> { return undefined; }
  async getOrganisationByStripeCustomerId(customerId: string): Promise<Organisation | undefined> { return undefined; }
  async updateOrganisation(id: string, updates: Partial<InsertOrganisation>): Promise<Organisation | undefined> { return undefined; }
  async getOrgsNearTrialExpiry(_withinDays: number, _notifiedWithinDays: number): Promise<Organisation[]> { return []; }
  async markOrgTrialExpiryNotified(_orgId: string, _notifiedAt: Date): Promise<void> {}
  async createInvitation(inv: InsertInvitation): Promise<Invitation> {
    throw new Error("MemStorage: createInvitation not supported");
  }
  async getInvitationByToken(token: string): Promise<Invitation | undefined> { return undefined; }
  async getInvitationsByOrg(orgId: string): Promise<Invitation[]> { return []; }
  async revokeInvitation(id: string): Promise<boolean> { return false; }
  async acceptInvitation(token: string): Promise<Invitation | undefined> { return undefined; }
  async updateInvitationToken(id: string, token: string, expiresAt: Date): Promise<Invitation | undefined> { return undefined; }
  async registerOrgWithAdmin(_params: {
    orgName: string; slug: string; userId: string; email: string;
    firstName: string | null; lastName: string | null;
    passwordHash: string; verificationToken: string;
  }): Promise<{ org: Organisation; user: User }> {
    throw new Error("MemStorage: registerOrgWithAdmin not supported");
  }
  async completeOnboarding(_userId: string): Promise<void> {}
  async setUserOrgId(_userId: string, _orgId: string): Promise<void> {}
  async getOrgUsage(_orgId: string): Promise<{ projects: number; users: number; catalogueItems: number; storageGb: number }> {
    return { projects: 0, users: 0, catalogueItems: 0, storageGb: 0 };
  }

  async getAllOrganisationsWithStats(): Promise<Array<Organisation & { userCount: number; projectCount: number; lastActivityAt: string | null; storageGb: number }>> {
    return [];
  }
  async writeSuperAdminAuditLog(_entry: InsertSuperadminAuditLog): Promise<SuperadminAuditLog> {
    throw new Error("MemStorage: writeSuperAdminAuditLog not supported");
  }
  async getSuperAdminAuditLogs(_limit?: number): Promise<SuperadminAuditLog[]> { return []; }
  async setUserSuperAdmin(_userId: string, _isSuperAdmin: boolean): Promise<void> {}

  // Working Drawings — MemStorage stubs
  async getRoomsForProject(_orgId: string, _projectId: string): Promise<Array<Room & { drawingCount: number }>> { return []; }
  async getDrawingsForProject(_orgId: string, _projectId: string, _search?: string, _drawingType?: string): Promise<Array<Drawing & { latestRevision: DrawingRevision | null; room: Room | null }>> { return []; }
  async createRoom(_orgId: string, _projectId: string, _data: { name: string; roomType: string }): Promise<Room> { throw new Error("Not implemented"); }
  async updateRoom(_id: string, _orgId: string, _data: { name: string; roomType: string }): Promise<Room | undefined> { return undefined; }
  async deleteRoom(_id: string, _orgId: string, _projectId: string): Promise<{ success: boolean; drawingCount: number }> { return { success: false, drawingCount: 0 }; }
  async updateDrawing(_id: string, _orgId: string, _data: { title?: string; roomId?: string | null; category?: string }): Promise<Drawing | undefined> { return undefined; }
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

  async getUsersByOrg(orgId: string): Promise<User[]> {
    const result = await db.select().from(users).where(eq(users.orgId, orgId));
    return result;
  }

  async removeUserFromOrg(userId: string): Promise<void> {
    await db.update(users).set({ orgId: null }).where(eq(users.id, userId));
    await db.update(userRoles).set({ isActive: false }).where(eq(userRoles.userId, userId));
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
          // Auto-complete onboarding for any existing user that never finished it.
          // COALESCE keeps an already-set timestamp; sets NOW() if still null.
          // This means every Replit OAuth login self-heals without needing migrations.
          onboardingCompletedAt: sql`COALESCE(${users.onboardingCompletedAt}, NOW())`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result[0];
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return result[0];
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async setEmailVerificationToken(userId: string, token: string): Promise<void> {
    await db.update(users)
      .set({ emailVerificationToken: token, emailVerifiedAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async setPasswordResetToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db.update(users)
      .set({ passwordResetToken: token, passwordResetTokenExpiry: expiry, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async resetPassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users)
      .set({
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
        emailVerificationToken: null,  // reset counts as verification
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async verifyEmail(token: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ emailVerifiedAt: new Date(), emailVerificationToken: null, updatedAt: new Date() })
      .where(eq(users.emailVerificationToken, token))
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

  async setUserRoleLinkedVendor(userId: string, linkedVendorId: string | null): Promise<void> {
    await db.update(userRoles)
      .set({ linkedVendorId })
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)));
  }

  // User Project Assignments - for project manager role
  async getUserProjectAssignments(userId: string): Promise<UserProjectAssignment[]> {
    return await db.select().from(userProjectAssignments).where(eq(userProjectAssignments.userId, userId));
  }

  async getAllUserProjectAssignments(): Promise<UserProjectAssignment[]> {
    return await db.select().from(userProjectAssignments);
  }

  async assignUserToProject(assignment: InsertUserProjectAssignment): Promise<UserProjectAssignment> {
    // Use onConflictDoUpdate to ensure we always get a row back (idempotent)
    const result = await db.insert(userProjectAssignments)
      .values(assignment)
      .onConflictDoUpdate({
        target: [userProjectAssignments.userId, userProjectAssignments.projectId],
        set: { assignedAt: sql`CURRENT_TIMESTAMP` } // Update timestamp to show last assignment
      })
      .returning();
    
    if (!result[0]) {
      throw new Error('Failed to assign user to project: no result returned');
    }
    
    return result[0];
  }

  async removeUserFromProject(userId: string, projectId: string): Promise<boolean> {
    const result = await db.delete(userProjectAssignments)
      .where(and(eq(userProjectAssignments.userId, userId), eq(userProjectAssignments.projectId, projectId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getUsersAssignedToProject(projectId: string): Promise<UserProjectAssignment[]> {
    return await db.select().from(userProjectAssignments).where(eq(userProjectAssignments.projectId, projectId));
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

  async getVendorsByIds(ids: string[]): Promise<Vendor[]> {
    if (ids.length === 0) return [];
    return await db.select().from(vendors).where(inArray(vendors.id, ids));
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
    // Check if vendor with this name already exists
    const existing = await db.select().from(vendors).where(eq(vendors.name, vendor.name));
    if (existing.length > 0) {
      throw new Error(`Vendor "${vendor.name}" already exists`);
    }
    
    const result = await db.insert(vendors).values(vendor).returning();
    return result[0];
  }

  async updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const result = await db.update(vendors).set(vendor).where(eq(vendors.id, id)).returning();
    return result[0];
  }

  async deleteVendor(id: string): Promise<boolean> {
    // Check if vendor has any quotations before deleting
    const hasQuotations = await db.select().from(projectVendors).where(eq(projectVendors.vendorId, id));
    
    if (hasQuotations.length > 0) {
      throw new Error("Cannot delete vendor with existing quotations. Please remove all quotes first.");
    }
    
    const result = await db.delete(vendors).where(eq(vendors.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Vendor Contacts
  async getVendorContacts(vendorId: string): Promise<VendorContact[]> {
    return await db.select()
      .from(vendorContacts)
      .where(eq(vendorContacts.vendorId, vendorId))
      .orderBy(desc(vendorContacts.isPrimary), vendorContacts.contactPerson);
  }

  async getVendorContact(id: string): Promise<VendorContact | undefined> {
    const result = await db.select().from(vendorContacts).where(eq(vendorContacts.id, id));
    return result[0];
  }

  async createVendorContact(contact: InsertVendorContact): Promise<VendorContact> {
    const result = await db.insert(vendorContacts).values(contact).returning();
    return result[0];
  }

  async updateVendorContact(id: string, contact: Partial<InsertVendorContact>): Promise<VendorContact | undefined> {
    const result = await db.update(vendorContacts).set(contact).where(eq(vendorContacts.id, id)).returning();
    return result[0];
  }

  async deleteVendorContact(id: string): Promise<boolean> {
    const result = await db.delete(vendorContacts).where(eq(vendorContacts.id, id));
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
    return await db.transaction(async (tx) => {
      // 1. Gather IDs we'll need for sub-deletes
      const pvRows = await tx.select({ id: projectVendors.id })
        .from(projectVendors).where(eq(projectVendors.projectId, id));
      const pvIds = pvRows.map(r => r.id);

      const taskRows = await tx.select({ id: tasks.id })
        .from(tasks).where(eq(tasks.projectId, id));
      const taskIds = taskRows.map(r => r.id);

      // 2. Delete works_orders for these project_vendors
      //    (works_order_signatures, works_order_items, works_order_files cascade via worksOrderId)
      if (pvIds.length > 0) {
        // Nullify self-reference: child project_vendors reference parent ones via parent_quotation_id
        await tx.update(projectVendors)
          .set({ parentQuotationId: null })
          .where(inArray(projectVendors.parentQuotationId, pvIds));

        // Nullify works_order_items.source_project_vendor_id references from any order (cross-project)
        await tx.update(worksOrderItems)
          .set({ sourceProjectVendorId: null })
          .where(inArray(worksOrderItems.sourceProjectVendorId, pvIds));

        await tx.delete(worksOrders).where(inArray(worksOrders.projectVendorId, pvIds));
        await tx.delete(boq).where(inArray(boq.projectVendorId, pvIds));
        await tx.delete(quoteFiles).where(inArray(quoteFiles.projectVendorId, pvIds));
      }

      // 3. Delete project_vendors
      await tx.delete(projectVendors).where(eq(projectVendors.projectId, id));

      // 4. Delete task dependents, then tasks
      if (taskIds.length > 0) {
        await tx.delete(taskDependencies).where(
          or(inArray(taskDependencies.fromTaskId, taskIds), inArray(taskDependencies.toTaskId, taskIds))
        );
        await tx.delete(taskAlerts).where(inArray(taskAlerts.taskId, taskIds));
        await tx.delete(approvals).where(inArray(approvals.taskId, taskIds));
      }
      await tx.delete(tasks).where(eq(tasks.projectId, id));
      await tx.delete(projectSchedules).where(eq(projectSchedules.projectId, id));

      // 5. Delete floor plans
      await tx.delete(floorPlans).where(eq(floorPlans.projectId, id));

      // 6. Nullify nullable FK references so they stay intact as historical records
      // Note: vendor_invoices has SET NULL in DB so it auto-handles, but explicit is fine.
      // Note: vendor_payments.project_id does NOT exist in production DB (migration pending) — skip it.
      await tx.update(moodboards).set({ projectId: null }).where(eq(moodboards.projectId, id));
      await tx.update(activityLog).set({ projectId: null }).where(eq(activityLog.projectId, id));
      await tx.update(vendorInvoices).set({ projectId: null }).where(eq(vendorInvoices.projectId, id));
      await tx.update(meetingMinutes).set({ projectId: null }).where(eq(meetingMinutes.projectId, id));
      await tx.update(paymentRequests).set({ projectId: null }).where(eq(paymentRequests.projectId, id));

      // 7. Finally delete the project (project_clients + user_project_assignments cascade)
      const result = await tx.delete(projects).where(eq(projects.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    });
  }

  // Project Clients
  async getProjectClients(projectId: string): Promise<ProjectClient[]> {
    return await db.select().from(projectClients).where(eq(projectClients.projectId, projectId));
  }

  async addProjectClient(client: InsertProjectClient): Promise<ProjectClient> {
    const result = await db.insert(projectClients).values(client).returning();
    return result[0];
  }

  async removeProjectClient(id: string): Promise<boolean> {
    const result = await db.delete(projectClients).where(eq(projectClients.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getManagerProjectsByEmail(email: string): Promise<ProjectClient[]> {
    return await db.select().from(projectClients).where(
      and(
        eq(projectClients.clientEmail, email),
        eq(projectClients.role, 'manager')
      )
    );
  }

  async getProjectsByClientEmail(clientEmail: string): Promise<Project[]> {
    // Get all project IDs that this client has access to
    const clientProjects = await db.select({ projectId: projectClients.projectId })
      .from(projectClients)
      .where(eq(projectClients.clientEmail, clientEmail));
    
    if (clientProjects.length === 0) {
      return [];
    }
    
    const projectIds = clientProjects.map(p => p.projectId);
    return await db.select().from(projects).where(inArray(projects.id, projectIds));
  }

  // Role-based access helper methods
  // Private helper to get accessible project IDs for a user
  private async getUserAccessibleProjects(userId: string): Promise<string[]> {
    const user = await this.getUser(userId);
    if (!user?.email) return [];
    
    // Get projects where user's email is in the project_clients table
    const userProjects = await db.select({ projectId: projectClients.projectId })
      .from(projectClients)
      .where(eq(projectClients.clientEmail, user.email));
    
    return userProjects.map(p => p.projectId);
  }

  async getProjectsForUser(userId: string, role: string): Promise<Project[]> {
    // Get all assignments for this user (used for restricted project access)
    const assignments = await this.getUserProjectAssignments(userId);
    const assignedProjectIds = new Set(assignments.map(a => a.projectId));

    // Look up the user's orgId so we can scope queries to their organisation.
    const user = await this.getUser(userId);
    const orgId = user?.orgId ?? null;

    // Helper: base project query scoped to the user's org.
    // Migration 0042 assigned orgIds to all legacy null-orgId projects,
    // so no isNull fallback is needed.
    const orgProjects = async () => {
      if (orgId) {
        return await db.select().from(projects).where(eq(projects.orgId, orgId));
      }
      return await db.select().from(projects);
    };

    // Admins see all projects in their org
    if (role === 'admin') {
      return await orgProjects();
    }

    // Designers: if they have any explicit project assignments, show ONLY those projects.
    // This allows the admin to scope a designer to specific projects (e.g. Shamrock-only).
    // If a designer has no assignments at all, fall back to showing all unrestricted projects
    // (preserves existing behaviour for designers who haven't been assigned to anything yet).
    if (role === 'designer') {
      const allProjects = await orgProjects();
      if (assignedProjectIds.size > 0) {
        return allProjects.filter(p => assignedProjectIds.has(p.id));
      }
      return allProjects.filter(p => !p.isRestricted);
    }
    
    // Project managers can only access assigned projects (restricted or not)
    if (role === 'project_manager') {
      if (assignedProjectIds.size === 0) return [];
      const orgWhere = orgId
        ? and(eq(projects.orgId, orgId), inArray(projects.id, Array.from(assignedProjectIds)))
        : inArray(projects.id, Array.from(assignedProjectIds));
      return await db.select().from(projects).where(orgWhere);
    }
    
    // Clients can only access projects where they're the client
    // user was already fetched above for orgId; reuse it
    if (!user?.email) return [];
    
    // Get projects from both old clientEmail field and new projectClients table
    const clientEmailProjects = await db.select().from(projects).where(eq(projects.clientEmail, user.email));
    const projectClientProjects = await this.getProjectsByClientEmail(user.email);
    
    // Combine and deduplicate
    const projectIds = new Set([
      ...clientEmailProjects.map(p => p.id),
      ...projectClientProjects.map(p => p.id)
    ]);
    return await db.select().from(projects).where(inArray(projects.id, Array.from(projectIds)));
  }

  async getProjectVendorsForUser(userId: string, role: string, projectId?: string): Promise<ProjectVendor[]> {
    // All roles (including admin) go through getProjectsForUser which handles org scoping.
    const accessibleProjects = await this.getProjectsForUser(userId, role);
    const accessibleProjectIds = accessibleProjects.map(p => p.id);

    if (accessibleProjectIds.length === 0) return [];

    if (projectId) {
      if (!accessibleProjectIds.includes(projectId)) return [];
      return await db.select().from(projectVendors).where(eq(projectVendors.projectId, projectId));
    }

    return await db.select().from(projectVendors).where(inArray(projectVendors.projectId, accessibleProjectIds));
  }

  async getBOQForUser(userId: string, role: string, projectVendorId: string): Promise<Boq[]> {
    if (role === 'admin') {
      return await db.select().from(boq).where(eq(boq.projectVendorId, projectVendorId));
    }

    const pvRow = await db.select().from(projectVendors).where(eq(projectVendors.id, projectVendorId));
    if (pvRow.length === 0) return [];

    const accessibleProjects = await this.getProjectsForUser(userId, role);
    const accessibleProjectIds = accessibleProjects.map(p => p.id);

    if (!accessibleProjectIds.includes(pvRow[0].projectId)) return [];

    return await db.select().from(boq).where(eq(boq.projectVendorId, projectVendorId));
  }

  async getQuoteFilesForUser(userId: string, role: string, projectVendorId: string): Promise<QuoteFile[]> {
    if (role === 'admin') {
      return await db.select().from(quoteFiles).where(eq(quoteFiles.projectVendorId, projectVendorId));
    }

    const pvRow = await db.select().from(projectVendors).where(eq(projectVendors.id, projectVendorId));
    if (pvRow.length === 0) return [];

    const accessibleProjects = await this.getProjectsForUser(userId, role);
    const accessibleProjectIds = accessibleProjects.map(p => p.id);

    if (!accessibleProjectIds.includes(pvRow[0].projectId)) return [];

    return await db.select().from(quoteFiles).where(eq(quoteFiles.projectVendorId, projectVendorId));
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
    if (!projectVendor.vendorId) {
      throw new Error("upsertProjectVendor requires vendorId");
    }
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
        
        // Delete all works order items that reference this project vendor as source
        await tx.delete(worksOrderItems).where(eq(worksOrderItems.sourceProjectVendorId, deleteId));
        
        // Delete all works orders that reference this project vendor
        // First get the works orders to delete their related files, items, and signatures
        const relatedWorksOrders = await tx.select().from(worksOrders)
          .where(eq(worksOrders.projectVendorId, deleteId));
        
        for (const wo of relatedWorksOrders) {
          // Delete works order files
          await tx.delete(worksOrderFiles).where(eq(worksOrderFiles.worksOrderId, wo.id));
          // Delete works order items
          await tx.delete(worksOrderItems).where(eq(worksOrderItems.worksOrderId, wo.id));
          // Delete works order signatures
          await tx.delete(worksOrderSignatures).where(eq(worksOrderSignatures.worksOrderId, wo.id));
        }
        
        // Now delete the works orders themselves
        await tx.delete(worksOrders).where(eq(worksOrders.projectVendorId, deleteId));
        
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

  async getProjectCategoriesWithQuotes(projectId: string): Promise<Array<{ category: string; quotesCount: number }>> {
    const regularQuotes = await db.select({
      categoryName: vendorCategories.name,
      quotesCount: sql<number>`count(*)::int`
    })
    .from(projectVendors)
    .innerJoin(vendors, eq(projectVendors.vendorId, vendors.id))
    .innerJoin(vendorCategories, eq(vendors.categoryId, vendorCategories.id))
    .where(eq(projectVendors.projectId, projectId))
    .groupBy(vendorCategories.name)
    .orderBy(vendorCategories.name);
    
    const comparativeStatements = await db.select({
      categoryName: projectVendors.category,
      quotesCount: sql<number>`count(*)::int`
    })
    .from(projectVendors)
    .where(
      and(
        eq(projectVendors.projectId, projectId),
        sql`${projectVendors.category} IS NOT NULL`,
        sql`${projectVendors.vendorId} IS NULL`
      )
    )
    .groupBy(projectVendors.category)
    .orderBy(projectVendors.category);
    
    const categoryMap = new Map<string, number>();
    
    for (const quote of regularQuotes) {
      categoryMap.set(quote.categoryName, (categoryMap.get(quote.categoryName) || 0) + quote.quotesCount);
    }
    
    for (const quote of comparativeStatements) {
      if (quote.categoryName) {
        categoryMap.set(quote.categoryName, (categoryMap.get(quote.categoryName) || 0) + quote.quotesCount);
      }
    }
    
    return Array.from(categoryMap.entries())
      .map(([category, quotesCount]) => ({ category, quotesCount }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  async getProjectQuotesByCategory(projectId: string, category: string): Promise<Array<ProjectVendor & { vendorName: string }>> {
    const regularQuotes = await db.select({
      projectVendor: projectVendors,
      vendorName: vendors.name,
      categoryName: vendorCategories.name
    })
    .from(projectVendors)
    .innerJoin(vendors, eq(projectVendors.vendorId, vendors.id))
    .innerJoin(vendorCategories, eq(vendors.categoryId, vendorCategories.id))
    .where(
      and(
        eq(projectVendors.projectId, projectId),
        eq(vendorCategories.name, category)
      )
    )
    .orderBy(projectVendors.submittedAt);
    
    const comparativeQuotes = await db.select({
      projectVendor: projectVendors,
      vendorName: sql<string>`NULL`,
      categoryName: projectVendors.category
    })
    .from(projectVendors)
    .where(
      and(
        eq(projectVendors.projectId, projectId),
        eq(projectVendors.category, category),
        sql`${projectVendors.vendorId} IS NULL`
      )
    )
    .orderBy(projectVendors.submittedAt);
    
    const allQuotes = [
      ...regularQuotes.map(q => ({
        ...q.projectVendor,
        vendorName: q.vendorName || 'Unknown Vendor'
      })),
      ...comparativeQuotes.map(q => ({
        ...q.projectVendor,
        vendorName: 'Comparative Statement'
      }))
    ];
    
    return allQuotes.sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  // Quote Templates
  async getAllQuoteTemplates(orgId?: string | null): Promise<QuoteTemplate[]> {
    // Exclude originalFileData to avoid bloating API responses
    const base = db.select({
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
    if (orgId) return await base.where(eq(quoteTemplates.orgId, orgId));
    return await base;
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

  async getBOQBulkByProjectVendors(projectVendorIds: string[]): Promise<Boq[]> {
    if (projectVendorIds.length === 0) return [];
    return await db.select().from(boq).where(inArray(boq.projectVendorId, projectVendorIds));
  }

  async getQuoteFilesBulkByProjectVendors(projectVendorIds: string[]): Promise<QuoteFile[]> {
    if (projectVendorIds.length === 0) return [];
    return await db.select().from(quoteFiles).where(inArray(quoteFiles.projectVendorId, projectVendorIds));
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
      return await db.select().from(moodboards).where(eq(moodboards.assetType, assetType)).orderBy(desc(moodboards.uploadedAt));
    }
    return await db.select().from(moodboards).orderBy(desc(moodboards.uploadedAt));
  }

  async getMoodboardsByProject(projectId: string, assetType?: string): Promise<Moodboard[]> {
    const conditions = [eq(moodboards.projectId, projectId)];
    if (assetType) {
      conditions.push(eq(moodboards.assetType, assetType));
    }
    return await db.select().from(moodboards).where(and(...conditions)).orderBy(desc(moodboards.uploadedAt));
  }

  async getGeneralMoodboards(assetType?: string): Promise<Moodboard[]> {
    const conditions = [isNull(moodboards.projectId)];
    if (assetType) {
      conditions.push(eq(moodboards.assetType, assetType));
    }
    return await db.select().from(moodboards).where(and(...conditions)).orderBy(desc(moodboards.uploadedAt));
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

  async getMoodboardsForUser(userId: string, role: string, projectId?: string, assetType?: string, orgId?: string | null): Promise<Moodboard[]> {
    if (role === 'designer' || role === 'admin') {
      const conditions = [];
      if (orgId) conditions.push(eq(moodboards.orgId, orgId));
      if (projectId && projectId !== 'general') {
        conditions.push(eq(moodboards.projectId, projectId));
      } else if (projectId === 'general') {
        conditions.push(isNull(moodboards.projectId));
      }
      if (assetType) {
        conditions.push(eq(moodboards.assetType, assetType));
      }
      
      if (conditions.length > 0) {
        return await db.select().from(moodboards).where(and(...conditions)).orderBy(desc(moodboards.uploadedAt));
      }
      return await db.select().from(moodboards).orderBy(desc(moodboards.uploadedAt));
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
      
      return await db.select().from(moodboards).where(and(...conditions)).orderBy(desc(moodboards.uploadedAt));
    }
  }

  async getVendorsForUser(userId: string, role: string): Promise<Vendor[]> {
    const user = await this.getUser(userId);
    const orgId = user?.orgId ?? null;
    if (orgId) {
      // Match vendors for this org, plus any legacy vendors with NULL org_id (safety net).
      // Migration 0045 will reassign orphaned org_ids, but OR NULL ensures nothing is hidden
      // if the migration hasn't yet run or another org_id mismatch occurs.
      return await db.select().from(vendors).where(
        or(eq(vendors.orgId, orgId), isNull(vendors.orgId))
      );
    }
    return await db.select().from(vendors);
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
    // First get all task IDs for this schedule
    const scheduleTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.scheduleId, id));
    const taskIds = scheduleTasks.map(t => t.id);
    
    // Delete task dependencies referencing these tasks
    if (taskIds.length > 0) {
      await db.delete(taskDependencies).where(
        or(
          inArray(taskDependencies.fromTaskId, taskIds),
          inArray(taskDependencies.toTaskId, taskIds)
        )
      );
    }
    
    // Delete all tasks for this schedule
    await db.delete(tasks).where(eq(tasks.scheduleId, id));
    
    // Finally delete the schedule
    const result = await db.delete(projectSchedules).where(eq(projectSchedules.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Task Management
  async getAllTasks(orgId?: string): Promise<Task[]> {
    // When orgId is provided, restrict to only that org's projects so the
    // dashboard cannot see tasks belonging to a different workspace.
    if (orgId) {
      return await db
        .select(getTableColumns(tasks))
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(projectSchedules, eq(tasks.scheduleId, projectSchedules.id))
        .where(eq(projects.orgId, orgId))
        .orderBy(
          asc(tasks.projectId),
          sql`${projectSchedules.uploadedAt} ASC NULLS LAST`,
          sql`${tasks.rowIndex} ASC NULLS LAST`,
          asc(tasks.createdAt),
          asc(tasks.id)
        );
    }
    return await db
      .select(getTableColumns(tasks))
      .from(tasks)
      .leftJoin(projectSchedules, eq(tasks.scheduleId, projectSchedules.id))
      .orderBy(
        // Group by project first so stats computed per-project are contiguous
        asc(tasks.projectId),
        // Within each project: schedule upload time keeps multiple imports in chronological order
        sql`${projectSchedules.uploadedAt} ASC NULLS LAST`,
        // Original Excel row sequence is the primary sort within a schedule
        sql`${tasks.rowIndex} ASC NULLS LAST`,
        // createdAt insertion order is the fallback for manually-created tasks (rowIndex = NULL)
        asc(tasks.createdAt),
        asc(tasks.id)
      );
  }

  async getAllTasksByProjectIds(projectIds: string[]): Promise<Task[]> {
    if (projectIds.length === 0) return [];
    return await db
      .select(getTableColumns(tasks))
      .from(tasks)
      .leftJoin(projectSchedules, eq(tasks.scheduleId, projectSchedules.id))
      .where(inArray(tasks.projectId, projectIds))
      .orderBy(
        asc(tasks.projectId),
        sql`${projectSchedules.uploadedAt} ASC NULLS LAST`,
        sql`${tasks.rowIndex} ASC NULLS LAST`,
        asc(tasks.createdAt),
        asc(tasks.id)
      );
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await db
      .select(getTableColumns(tasks))
      .from(tasks)
      .leftJoin(projectSchedules, eq(tasks.scheduleId, projectSchedules.id))
      .where(eq(tasks.projectId, projectId))
      .orderBy(
        sql`${projectSchedules.uploadedAt} ASC NULLS LAST`,
        sql`${tasks.rowIndex} ASC NULLS LAST`,
        asc(tasks.createdAt),
        asc(tasks.id)
      );
  }

  async getTasksBySchedule(scheduleId: string): Promise<Task[]> {
    return await db
      .select(getTableColumns(tasks))
      .from(tasks)
      .where(eq(tasks.scheduleId, scheduleId))
      .orderBy(
        sql`${tasks.rowIndex} ASC NULLS LAST`,
        asc(tasks.createdAt),
        asc(tasks.id)
      );
  }

  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async createTask(task: InsertTask & { createdAt?: Date }): Promise<Task> {
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

  // Activity Log
  async getRecentActivities(limit: number = 20, projectId?: string): Promise<ActivityLog[]> {
    if (projectId) {
      return await db.select()
        .from(activityLog)
        .where(eq(activityLog.projectId, projectId))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit);
    }
    return await db.select()
      .from(activityLog)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
  }

  async getRecentActivitiesByOrg(orgId: string, limit: number = 20): Promise<ActivityLog[]> {
    // Fetch activities scoped to the organisation by joining through users.orgId.
    // This is O(1) in query cost regardless of how many orgs exist.
    return await db
      .select({ activityLog })
      .from(activityLog)
      .innerJoin(users, eq(activityLog.userId, users.id))
      .where(eq(users.orgId, orgId))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit)
      .then(rows => rows.map(r => r.activityLog));
  }

  async createActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLog).values(activity).returning();
    return result[0];
  }

  // Vendor Invoices
  async getVendorInvoices(vendorId: string): Promise<VendorInvoice[]> {
    return await db.select()
      .from(vendorInvoices)
      .where(eq(vendorInvoices.vendorId, vendorId))
      .orderBy(desc(vendorInvoices.invoiceDate));
  }

  async getVendorInvoice(id: string): Promise<VendorInvoice | undefined> {
    const result = await db.select().from(vendorInvoices).where(eq(vendorInvoices.id, id));
    return result[0];
  }

  async createVendorInvoice(invoice: InsertVendorInvoice): Promise<VendorInvoice> {
    const result = await db.insert(vendorInvoices).values(invoice).returning();
    return result[0];
  }

  async updateVendorInvoice(id: string, invoice: Partial<InsertVendorInvoice>): Promise<VendorInvoice | undefined> {
    const result = await db.update(vendorInvoices).set(invoice).where(eq(vendorInvoices.id, id)).returning();
    return result[0];
  }

  async deleteVendorInvoice(id: string): Promise<boolean> {
    const result = await db.delete(vendorInvoices).where(eq(vendorInvoices.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Vendor Payments
  async getVendorPayments(vendorId: string): Promise<VendorPayment[]> {
    try {
      return await db.select()
        .from(vendorPayments)
        .where(eq(vendorPayments.vendorId, vendorId))
        .orderBy(desc(vendorPayments.paymentDate));
    } catch (err: any) {
      if (err.message?.includes('column') && err.message?.includes('project_id')) {
        const rows = await db.execute(sql`SELECT id, vendor_id as "vendorId", payment_date as "paymentDate", payment_reference as "paymentReference", amount, payment_method as "paymentMethod", notes, created_by as "createdBy", created_at as "createdAt", attachment_path as "attachmentPath", org_id as "orgId" FROM vendor_payments WHERE vendor_id = ${vendorId} ORDER BY payment_date DESC`);
        return rows.rows as unknown as VendorPayment[];
      }
      throw err;
    }
  }

  async getAllPaymentsWithVendors(): Promise<Array<VendorPayment & { vendorName: string }>> {
    try {
      const results = await db.select({
        id: vendorPayments.id,
        vendorId: vendorPayments.vendorId,
        projectId: vendorPayments.projectId,
        paymentDate: vendorPayments.paymentDate,
        paymentReference: vendorPayments.paymentReference,
        amount: vendorPayments.amount,
        paymentMethod: vendorPayments.paymentMethod,
        notes: vendorPayments.notes,
        createdBy: vendorPayments.createdBy,
        createdAt: vendorPayments.createdAt,
        vendorName: vendors.name,
      })
      .from(vendorPayments)
      .innerJoin(vendors, eq(vendorPayments.vendorId, vendors.id))
      .orderBy(desc(vendorPayments.paymentDate));
      return results;
    } catch (err: any) {
      if (err.message?.includes('column') && err.message?.includes('project_id')) {
        const rows = await db.execute(sql`SELECT vp.id, vp.vendor_id as "vendorId", vp.payment_date as "paymentDate", vp.payment_reference as "paymentReference", vp.amount, vp.payment_method as "paymentMethod", vp.notes, vp.created_by as "createdBy", vp.created_at as "createdAt", vp.attachment_path as "attachmentPath", vp.org_id as "orgId", v.name as "vendorName" FROM vendor_payments vp INNER JOIN vendors v ON vp.vendor_id = v.id ORDER BY vp.payment_date DESC`);
        return rows.rows as unknown as Array<VendorPayment & { vendorName: string }>;
      }
      throw err;
    }
  }

  async getVendorPayment(id: string): Promise<VendorPayment | undefined> {
    const result = await db.select().from(vendorPayments).where(eq(vendorPayments.id, id));
    return result[0];
  }

  async createVendorPayment(payment: InsertVendorPayment): Promise<VendorPayment> {
    try {
      const result = await db.insert(vendorPayments).values(payment).returning();
      return result[0];
    } catch (err: any) {
      if (err.message?.includes('column') && err.message?.includes('project_id')) {
        const { projectId, ...paymentWithoutProject } = payment as any;
        const result = await db.insert(vendorPayments).values(paymentWithoutProject).returning();
        return result[0];
      }
      throw err;
    }
  }

  async updateVendorPayment(id: string, payment: Partial<InsertVendorPayment>): Promise<VendorPayment | undefined> {
    try {
      const result = await db.update(vendorPayments).set(payment).where(eq(vendorPayments.id, id)).returning();
      return result[0];
    } catch (err: any) {
      if (err.message?.includes('column') && err.message?.includes('project_id')) {
        const { projectId, ...paymentWithoutProject } = payment as any;
        const result = await db.update(vendorPayments).set(paymentWithoutProject).where(eq(vendorPayments.id, id)).returning();
        return result[0];
      }
      throw err;
    }
  }

  async deleteVendorPayment(id: string): Promise<boolean> {
    const result = await db.delete(vendorPayments).where(eq(vendorPayments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getAccessibleVendorIds(userId: string, role: string): Promise<Set<string> | null> {
    if (role === 'admin') return null; // no restriction for admins

    const accessibleProjects = await this.getProjectsForUser(userId, role);
    if (accessibleProjects.length === 0) return new Set(); // no projects → no vendors

    const accessibleProjectIds = accessibleProjects.map(p => p.id);

    // Vendors that are linked to at least one accessible project
    const linkedRows = await db
      .selectDistinct({ vendorId: projectVendors.vendorId })
      .from(projectVendors)
      .where(inArray(projectVendors.projectId, accessibleProjectIds));

    const accessibleVendorIds = new Set(
      linkedRows.map(r => r.vendorId).filter(Boolean) as string[]
    );

    // Also include vendors that have NO project_vendors rows at all (unlinked/global vendors)
    const allVendorIds = (await db.select({ id: vendors.id }).from(vendors)).map(v => v.id);
    const linkedVendorIds = new Set(
      (await db.selectDistinct({ vendorId: projectVendors.vendorId }).from(projectVendors))
        .map(r => r.vendorId).filter(Boolean) as string[]
    );
    for (const vid of allVendorIds) {
      if (!linkedVendorIds.has(vid)) accessibleVendorIds.add(vid);
    }

    return accessibleVendorIds;
  }

  // Catalogue Items
  async getAllCatalogueItems(orgId?: string | null): Promise<CatalogueItem[]> {
    if (orgId) return await db.select().from(catalogueItems).where(eq(catalogueItems.orgId, orgId)).orderBy(catalogueItems.mainCategory, catalogueItems.subcategory);
    return await db.select().from(catalogueItems).orderBy(catalogueItems.mainCategory, catalogueItems.subcategory);
  }

  async getCatalogueItem(id: string): Promise<CatalogueItem | undefined> {
    const result = await db.select().from(catalogueItems).where(eq(catalogueItems.id, id));
    return result[0];
  }

  async getMainCategories(orgId?: string | null): Promise<string[]> {
    const q = db.selectDistinct({ mainCategory: catalogueItems.mainCategory }).from(catalogueItems);
    const result = orgId ? await q.where(eq(catalogueItems.orgId, orgId)).orderBy(catalogueItems.mainCategory)
      : await q.orderBy(catalogueItems.mainCategory);
    return result.map(r => r.mainCategory);
  }

  async getCategoriesWithImageCounts(orgId?: string | null): Promise<{ category: string; imageCount: number }[]> {
    const allItems = orgId
      ? await db.select().from(catalogueItems).where(eq(catalogueItems.orgId, orgId))
      : await db.select().from(catalogueItems);
    const categoryCounts = new Map<string, number>();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
    
    for (const item of allItems) {
      // Check for AI image path first
      let hasImage = !!item.aiImagePath;
      
      // If no AI image, check fileName for image extensions (filePath stores UUID path without extension)
      if (!hasImage && item.fileName && item.filePath) {
        const ext = item.fileName.split('.').pop()?.toLowerCase() || '';
        hasImage = imageExtensions.includes(ext);
      }
      
      const currentCount = categoryCounts.get(item.mainCategory) || 0;
      if (hasImage) {
        categoryCounts.set(item.mainCategory, currentCount + 1);
      } else if (!categoryCounts.has(item.mainCategory)) {
        categoryCounts.set(item.mainCategory, 0);
      }
    }
    
    return Array.from(categoryCounts.entries())
      .map(([category, imageCount]) => ({ category, imageCount }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  async getCatalogueItemsByCategory(mainCategory?: string, subcategory?: string, orgId?: string | null): Promise<CatalogueItem[]> {
    if (!mainCategory && !subcategory) {
      return this.getAllCatalogueItems(orgId);
    }
    
    const conditions: any[] = [];
    if (orgId) conditions.push(eq(catalogueItems.orgId, orgId));
    if (mainCategory) conditions.push(eq(catalogueItems.mainCategory, mainCategory));
    if (subcategory) conditions.push(eq(catalogueItems.subcategory, subcategory));
    
    return await db.select()
      .from(catalogueItems)
      .where(and(...conditions))
      .orderBy(catalogueItems.subcategory);
  }

  async getCatalogueItemsCount(orgId?: string | null): Promise<number> {
    if (orgId) {
      const result = await db.select({ count: sql<number>`count(*)` }).from(catalogueItems).where(eq(catalogueItems.orgId, orgId));
      return result[0]?.count || 0;
    }
    const result = await db.select({ count: sql<number>`count(*)` }).from(catalogueItems);
    return result[0]?.count || 0;
  }

  async createCatalogueItem(item: InsertCatalogueItem): Promise<CatalogueItem> {
    const result = await db.insert(catalogueItems).values(item).returning();
    return result[0];
  }

  async createCatalogueItemWithId(item: InsertCatalogueItem & { id: string }): Promise<CatalogueItem> {
    const result = await db.insert(catalogueItems).values(item).returning();
    return result[0];
  }

  async updateCatalogueItem(id: string, item: Partial<InsertCatalogueItem>): Promise<CatalogueItem | undefined> {
    const result = await db.update(catalogueItems).set(item).where(eq(catalogueItems.id, id)).returning();
    return result[0];
  }

  async deleteCatalogueItem(id: string): Promise<boolean> {
    const result = await db.delete(catalogueItems).where(eq(catalogueItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Specifications
  async getAllSpecifications(orgId?: string | null): Promise<Specification[]> {
    if (orgId) return await db.select().from(specifications).where(eq(specifications.orgId, orgId)).orderBy(specifications.category, specifications.title);
    return await db.select().from(specifications).orderBy(specifications.category, specifications.title);
  }

  async getSpecification(id: string): Promise<Specification | undefined> {
    const result = await db.select().from(specifications).where(eq(specifications.id, id));
    return result[0];
  }

  async getSpecificationsByCategory(category: string, orgId?: string | null): Promise<Specification[]> {
    const conditions: any[] = [eq(specifications.category, category)];
    if (orgId) conditions.push(eq(specifications.orgId, orgId));
    return await db.select()
      .from(specifications)
      .where(and(...conditions))
      .orderBy(specifications.title);
  }

  async getSpecificationCategories(orgId?: string | null): Promise<string[]> {
    const q = db.selectDistinct({ category: specifications.category }).from(specifications);
    const result = orgId ? await q.where(eq(specifications.orgId, orgId)).orderBy(specifications.category)
      : await q.orderBy(specifications.category);
    return result.map(r => r.category);
  }

  async createSpecification(spec: InsertSpecification): Promise<Specification> {
    const result = await db.insert(specifications).values(spec).returning();
    return result[0];
  }

  async updateSpecification(id: string, spec: Partial<InsertSpecification>): Promise<Specification | undefined> {
    const result = await db.update(specifications).set(spec).where(eq(specifications.id, id)).returning();
    return result[0];
  }

  async deleteSpecification(id: string): Promise<boolean> {
    const result = await db.delete(specifications).where(eq(specifications.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Saved Assets methods
  async getAllSavedAssets(orgId?: string | null): Promise<SavedAsset[]> {
    if (orgId) return await db.select().from(savedAssets).where(eq(savedAssets.orgId, orgId)).orderBy(desc(savedAssets.savedAt));
    return await db.select().from(savedAssets).orderBy(desc(savedAssets.savedAt));
  }

  async getSavedAsset(id: string): Promise<SavedAsset | undefined> {
    const result = await db.select().from(savedAssets).where(eq(savedAssets.id, id));
    return result[0];
  }

  async getSavedAssetsByUser(userId: string): Promise<SavedAsset[]> {
    return await db.select()
      .from(savedAssets)
      .where(eq(savedAssets.savedBy, userId))
      .orderBy(desc(savedAssets.savedAt));
  }

  async createSavedAsset(asset: InsertSavedAsset): Promise<SavedAsset> {
    const result = await db.insert(savedAssets).values(asset).returning();
    return result[0];
  }

  async updateSavedAsset(id: string, asset: Partial<InsertSavedAsset>): Promise<SavedAsset | undefined> {
    const result = await db.update(savedAssets)
      .set(asset)
      .where(eq(savedAssets.id, id))
      .returning();
    return result[0];
  }

  async deleteSavedAsset(id: string): Promise<boolean> {
    const result = await db.delete(savedAssets).where(eq(savedAssets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Meeting Minutes methods
  async getAllMeetingMinutes(orgId?: string | null): Promise<MeetingMinutes[]> {
    const where = orgId ? eq(meetingMinutes.orgId, orgId) : undefined;
    return await db.select().from(meetingMinutes)
      .where(where)
      .orderBy(desc(meetingMinutes.meetingDate));
  }

  async getMeetingMinutes(id: string): Promise<MeetingMinutes | undefined> {
    const result = await db.select().from(meetingMinutes).where(eq(meetingMinutes.id, id));
    return result[0];
  }

  async getMeetingMinutesByProject(projectId: string, orgId?: string | null): Promise<MeetingMinutes[]> {
    const where = orgId
      ? and(eq(meetingMinutes.projectId, projectId), eq(meetingMinutes.orgId, orgId))
      : eq(meetingMinutes.projectId, projectId);
    return await db.select()
      .from(meetingMinutes)
      .where(where)
      .orderBy(desc(meetingMinutes.meetingDate));
  }

  async getMeetingMinutesByDateRange(startDate: string, endDate: string, orgId?: string | null): Promise<MeetingMinutes[]> {
    const where = orgId
      ? and(
          sql`${meetingMinutes.meetingDate} >= ${startDate}`,
          sql`${meetingMinutes.meetingDate} <= ${endDate}`,
          eq(meetingMinutes.orgId, orgId)
        )
      : and(
          sql`${meetingMinutes.meetingDate} >= ${startDate}`,
          sql`${meetingMinutes.meetingDate} <= ${endDate}`
        );
    return await db.select()
      .from(meetingMinutes)
      .where(where)
      .orderBy(desc(meetingMinutes.meetingDate));
  }

  async createMeetingMinutes(minutes: InsertMeetingMinutes): Promise<MeetingMinutes> {
    const result = await db.insert(meetingMinutes).values(minutes as any).returning();
    return result[0];
  }

  async updateMeetingMinutes(id: string, minutes: Partial<InsertMeetingMinutes>): Promise<MeetingMinutes | undefined> {
    const result = await db.update(meetingMinutes).set(minutes as any).where(eq(meetingMinutes.id, id)).returning();
    return result[0];
  }

  async deleteMeetingMinutes(id: string): Promise<boolean> {
    const result = await db.delete(meetingMinutes).where(eq(meetingMinutes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Meeting Action Items methods
  async getMeetingActionItems(meetingMinutesId: string): Promise<MeetingActionItem[]> {
    return await db.select()
      .from(meetingActionItems)
      .where(eq(meetingActionItems.meetingMinutesId, meetingMinutesId))
      .orderBy(meetingActionItems.serialNo);
  }

  async createMeetingActionItem(item: InsertMeetingActionItem): Promise<MeetingActionItem> {
    const result = await db.insert(meetingActionItems).values(item).returning();
    return result[0];
  }

  async deleteMeetingActionItems(meetingMinutesId: string): Promise<boolean> {
    const result = await db.delete(meetingActionItems).where(eq(meetingActionItems.meetingMinutesId, meetingMinutesId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  // Works Order Templates methods
  async getAllWorksOrderTemplates(): Promise<WorksOrderTemplate[]> {
    return await db.select().from(worksOrderTemplates).orderBy(desc(worksOrderTemplates.createdAt));
  }

  async getWorksOrderTemplate(id: string): Promise<WorksOrderTemplate | undefined> {
    const result = await db.select().from(worksOrderTemplates).where(eq(worksOrderTemplates.id, id));
    return result[0];
  }

  async getActiveWorksOrderTemplates(): Promise<WorksOrderTemplate[]> {
    return await db.select()
      .from(worksOrderTemplates)
      .where(eq(worksOrderTemplates.isActive, true))
      .orderBy(worksOrderTemplates.name);
  }

  async getWorksOrderTemplatesForUser(userId: string, role: string): Promise<WorksOrderTemplate[]> {
    // Clients cannot access templates
    if (role === 'client') {
      return [];
    }
    // Admins and designers can access all active templates
    return this.getActiveWorksOrderTemplates();
  }

  async createWorksOrderTemplate(template: InsertWorksOrderTemplate): Promise<WorksOrderTemplate> {
    const result = await db.insert(worksOrderTemplates).values(template).returning();
    return result[0];
  }

  async updateWorksOrderTemplate(id: string, updates: Partial<InsertWorksOrderTemplate>): Promise<WorksOrderTemplate | undefined> {
    const result = await db.update(worksOrderTemplates).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(worksOrderTemplates.id, id)).returning();
    return result[0];
  }

  async deleteWorksOrderTemplate(id: string): Promise<boolean> {
    const result = await db.delete(worksOrderTemplates).where(eq(worksOrderTemplates.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Works Orders methods
  async getAllWorksOrders(): Promise<any[]> {
    const result = await db.select({
      worksOrder: worksOrders,
      projectName: projects.projectName,
      projectId: projects.id,
      category: projectVendors.category,
      vendorName: vendors.name,
    })
      .from(worksOrders)
      .leftJoin(projectVendors, eq(worksOrders.projectVendorId, projectVendors.id))
      .leftJoin(projects, eq(projectVendors.projectId, projects.id))
      .leftJoin(vendors, eq(projectVendors.vendorId, vendors.id))
      .orderBy(desc(worksOrders.createdAt));

    return result.map(r => ({ ...r.worksOrder, projectName: r.projectName, projectId: r.projectId, category: r.category, vendorName: r.vendorName }));
  }

  async getWorksOrder(id: string): Promise<WorksOrder | undefined> {
    const result = await db.select().from(worksOrders).where(eq(worksOrders.id, id));
    return result[0];
  }

  async getWorksOrderWithRelations(id: string): Promise<WorksOrder & { projectName?: string; clientName?: string; vendorName?: string; templateName?: string } | undefined> {
    const result = await db.select({
      worksOrder: worksOrders,
      projectName: projects.projectName,
      clientName: projects.clientName,
      vendorName: vendors.name,
      templateName: worksOrderTemplates.name,
    })
      .from(worksOrders)
      .leftJoin(projectVendors, eq(worksOrders.projectVendorId, projectVendors.id))
      .leftJoin(projects, eq(projectVendors.projectId, projects.id))
      .leftJoin(vendors, eq(projectVendors.vendorId, vendors.id))
      .leftJoin(worksOrderTemplates, eq(worksOrders.templateId, worksOrderTemplates.id))
      .where(eq(worksOrders.id, id));

    if (!result[0]) return undefined;

    return {
      ...result[0].worksOrder,
      projectName: result[0].projectName || undefined,
      clientName: result[0].clientName || undefined,
      vendorName: result[0].vendorName || undefined,
      templateName: result[0].templateName || undefined,
    };
  }

  async getWorksOrdersByProject(projectId: string): Promise<any[]> {
    const result = await db.select({
      worksOrder: worksOrders,
      projectName: projects.projectName,
      projectId: projects.id,
      category: projectVendors.category,
      vendorName: vendors.name,
    })
      .from(worksOrders)
      .leftJoin(projectVendors, eq(worksOrders.projectVendorId, projectVendors.id))
      .leftJoin(projects, eq(projectVendors.projectId, projects.id))
      .leftJoin(vendors, eq(projectVendors.vendorId, vendors.id))
      .where(eq(projectVendors.projectId, projectId))
      .orderBy(desc(worksOrders.createdAt));
    
    return result.map(r => ({ ...r.worksOrder, projectName: r.projectName, projectId: r.projectId, category: r.category, vendorName: r.vendorName }));
  }

  async getWorksOrdersByProjectVendor(projectVendorId: string): Promise<WorksOrder[]> {
    return await db.select()
      .from(worksOrders)
      .where(eq(worksOrders.projectVendorId, projectVendorId))
      .orderBy(desc(worksOrders.createdAt));
  }

  async getWorksOrdersForUser(userId: string, role: string, projectId?: string): Promise<WorksOrder[]> {
    // All roles go through getProjectsForUser which handles org scoping.
    const userProjects = await this.getProjectsForUser(userId, role);
    const accessibleProjectIds = userProjects.map(p => p.id);

    if (accessibleProjectIds.length === 0) return [];

    if (projectId) {
      if (!accessibleProjectIds.includes(projectId)) return [];
      return this.getWorksOrdersByProject(projectId);
    }

    const result = await db.select({
      worksOrder: worksOrders,
      projectName: projects.projectName,
      projectId: projects.id,
      category: projectVendors.category,
      vendorName: vendors.name,
    })
      .from(worksOrders)
      .leftJoin(projectVendors, eq(worksOrders.projectVendorId, projectVendors.id))
      .leftJoin(projects, eq(projectVendors.projectId, projects.id))
      .leftJoin(vendors, eq(projectVendors.vendorId, vendors.id))
      .where(inArray(projectVendors.projectId, accessibleProjectIds))
      .orderBy(desc(worksOrders.createdAt));

    return result.map(r => ({ ...r.worksOrder, projectName: r.projectName, projectId: r.projectId, category: r.category, vendorName: r.vendorName }));
  }

  async getWorksOrderByToken(token: string): Promise<WorksOrder | undefined> {
    const result = await db.select().from(worksOrders).where(eq(worksOrders.accessToken, token));
    return result[0];
  }

  async createWorksOrder(order: InsertWorksOrder): Promise<WorksOrder> {
    const result = await db.insert(worksOrders).values(order).returning();
    return result[0];
  }

  async updateWorksOrder(id: string, updates: Partial<InsertWorksOrder>): Promise<WorksOrder | undefined> {
    const result = await db.update(worksOrders).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(worksOrders.id, id)).returning();
    return result[0];
  }

  async updateWorksOrderStatus(id: string, status: string, metadata?: { sentAt?: Date; signedAt?: Date; voidedAt?: Date; voidReason?: string; signedFilePath?: string }): Promise<WorksOrder | undefined> {
    const updates: any = {
      status,
      updatedAt: new Date(),
    };

    if (metadata) {
      if (metadata.sentAt) updates.sentAt = metadata.sentAt;
      if (metadata.signedAt) updates.signedAt = metadata.signedAt;
      if (metadata.voidedAt) updates.voidedAt = metadata.voidedAt;
      if (metadata.voidReason) updates.voidReason = metadata.voidReason;
      if (metadata.signedFilePath) updates.signedFilePath = metadata.signedFilePath;
    }

    const result = await db.update(worksOrders).set(updates).where(eq(worksOrders.id, id)).returning();
    return result[0];
  }

  async deleteWorksOrder(id: string): Promise<boolean> {
    const result = await db.delete(worksOrders).where(eq(worksOrders.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    
    // Get count of orders this year
    const yearStart = `${year}-01-01`;
    const result = await db.select()
      .from(worksOrders)
      .where(and(
        sql`${worksOrders.createdAt} >= ${yearStart}::date`
      ));

    const count = result.length + 1;
    const paddedCount = count.toString().padStart(3, '0');
    
    return `WO-${year}-${paddedCount}`;
  }

  // Works Order Signatures methods
  async getSignaturesByWorksOrder(worksOrderId: string): Promise<WorksOrderSignature[]> {
    return await db.select()
      .from(worksOrderSignatures)
      .where(eq(worksOrderSignatures.worksOrderId, worksOrderId))
      .orderBy(worksOrderSignatures.signedAt);
  }

  async getSignatureByOrderAndEmail(worksOrderId: string, email: string): Promise<WorksOrderSignature | undefined> {
    const result = await db.select()
      .from(worksOrderSignatures)
      .where(and(
        eq(worksOrderSignatures.worksOrderId, worksOrderId),
        eq(worksOrderSignatures.signerEmail, email)
      ));
    return result[0];
  }

  async createSignature(signature: InsertWorksOrderSignature): Promise<WorksOrderSignature> {
    const result = await db.insert(worksOrderSignatures).values(signature).returning();
    return result[0];
  }

  async getWorksOrderItems(worksOrderId: string): Promise<WorksOrderItem[]> {
    return await db.select()
      .from(worksOrderItems)
      .where(eq(worksOrderItems.worksOrderId, worksOrderId))
      .orderBy(worksOrderItems.sortOrder);
  }

  async createWorksOrderItem(item: InsertWorksOrderItem): Promise<WorksOrderItem> {
    const result = await db.insert(worksOrderItems).values(item).returning();
    return result[0];
  }

  async createWorksOrderItemsBatch(items: InsertWorksOrderItem[]): Promise<WorksOrderItem[]> {
    if (items.length === 0) return [];
    const result = await db.insert(worksOrderItems).values(items).returning();
    return result;
  }

  async updateWorksOrderItem(id: string, updates: Partial<InsertWorksOrderItem>): Promise<WorksOrderItem | undefined> {
    const result = await db.update(worksOrderItems)
      .set(updates)
      .where(eq(worksOrderItems.id, id))
      .returning();
    return result[0];
  }

  async deleteWorksOrderItem(id: string): Promise<boolean> {
    const result = await db.delete(worksOrderItems).where(eq(worksOrderItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteWorksOrderItemsByOrder(worksOrderId: string): Promise<boolean> {
    await db.delete(worksOrderItems).where(eq(worksOrderItems.worksOrderId, worksOrderId));
    return true;
  }

  async replaceWorksOrderItems(worksOrderId: string, items: InsertWorksOrderItem[]): Promise<WorksOrderItem[]> {
    for (const item of items) {
      if (item.worksOrderId !== worksOrderId) {
        throw new Error(`Item worksOrderId mismatch: expected ${worksOrderId}, got ${item.worksOrderId}`);
      }
    }
    
    return await db.transaction(async (tx) => {
      const lockedOrder = await tx.select().from(worksOrders).where(eq(worksOrders.id, worksOrderId)).for('update');
      
      if (lockedOrder.length === 0) {
        throw new Error(`Works order ${worksOrderId} not found`);
      }
      
      if (lockedOrder[0].status === 'signed' || lockedOrder[0].status === 'void') {
        throw new Error(`Cannot modify items for ${lockedOrder[0].status} works order`);
      }
      
      await tx.delete(worksOrderItems).where(eq(worksOrderItems.worksOrderId, worksOrderId));
      
      if (items.length === 0) {
        return [];
      }
      
      const result = await tx.insert(worksOrderItems).values(items).returning();
      return result;
    });
  }

  // Object Assets methods for photo processing
  async getAllObjectAssets(): Promise<ObjectAsset[]> {
    return await db.select().from(objectAssets).orderBy(desc(objectAssets.createdAt));
  }

  async getObjectAsset(id: string): Promise<ObjectAsset | undefined> {
    const result = await db.select().from(objectAssets).where(eq(objectAssets.id, id));
    return result[0];
  }

  async getObjectAssetsByType(objectType: string): Promise<ObjectAsset[]> {
    return await db.select()
      .from(objectAssets)
      .where(eq(objectAssets.objectType, objectType))
      .orderBy(desc(objectAssets.createdAt));
  }

  async getObjectAssetsByStatus(status: string): Promise<ObjectAsset[]> {
    return await db.select()
      .from(objectAssets)
      .where(eq(objectAssets.processingStatus, status))
      .orderBy(desc(objectAssets.createdAt));
  }

  async getObjectAssetsByUser(userId: string): Promise<ObjectAsset[]> {
    return await db.select()
      .from(objectAssets)
      .where(eq(objectAssets.uploadedBy, userId))
      .orderBy(desc(objectAssets.createdAt));
  }

  async createObjectAsset(asset: InsertObjectAsset): Promise<ObjectAsset> {
    const result = await db.insert(objectAssets).values(asset).returning();
    return result[0];
  }

  async updateObjectAsset(id: string, updates: Partial<InsertObjectAsset>): Promise<ObjectAsset | undefined> {
    const result = await db.update(objectAssets)
      .set(updates)
      .where(eq(objectAssets.id, id))
      .returning();
    return result[0];
  }

  async updateObjectAssetProcessing(id: string, updates: {
    processingStatus: string;
    processedFilePath?: string;
    thumbnailPath?: string;
    transparentPath?: string;
    detectedBounds?: any;
    dimensions?: any;
    aiDescription?: string;
    aiPromptHints?: string;
    processingError?: string;
    processedAt?: Date;
    reprocessCount?: number;
  }): Promise<ObjectAsset | undefined> {
    const result = await db.update(objectAssets)
      .set(updates)
      .where(eq(objectAssets.id, id))
      .returning();
    return result[0];
  }

  async deleteObjectAsset(id: string): Promise<boolean> {
    const result = await db.delete(objectAssets).where(eq(objectAssets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async linkAssetToCatalogue(assetId: string, catalogueItemId: string): Promise<ObjectAsset | undefined> {
    const result = await db.update(objectAssets)
      .set({ catalogueItemId })
      .where(eq(objectAssets.id, assetId))
      .returning();
    return result[0];
  }

  // SOPs
  async getAllSops(orgId?: string | null): Promise<Sop[]> {
    if (orgId) return await db.select().from(sops).where(eq(sops.orgId, orgId)).orderBy(sops.category, sops.title);
    return await db.select().from(sops).orderBy(sops.category, sops.title);
  }

  async getSop(id: string): Promise<Sop | undefined> {
    const result = await db.select().from(sops).where(eq(sops.id, id));
    return result[0];
  }

  async getSopsByCategory(category: string, orgId?: string | null): Promise<Sop[]> {
    const conditions: any[] = [eq(sops.category, category)];
    if (orgId) conditions.push(eq(sops.orgId, orgId));
    return await db.select().from(sops).where(and(...conditions)).orderBy(sops.title);
  }

  async getSopCategories(orgId?: string | null): Promise<string[]> {
    const q = db.selectDistinct({ category: sops.category }).from(sops);
    const rows = orgId ? await q.where(eq(sops.orgId, orgId)).orderBy(sops.category)
      : await q.orderBy(sops.category);
    return rows.map(r => r.category);
  }

  async createSop(sop: InsertSop): Promise<Sop> {
    const result = await db.insert(sops).values(sop).returning();
    return result[0];
  }

  async updateSop(id: string, sop: Partial<InsertSop>): Promise<Sop | undefined> {
    const result = await db.update(sops)
      .set({ ...sop, updatedAt: new Date() })
      .where(eq(sops.id, id))
      .returning();
    return result[0];
  }

  async deleteSop(id: string): Promise<boolean> {
    const result = await db.delete(sops).where(eq(sops.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Project Cost Items
  async getProjectCostItems(projectId: string): Promise<ProjectCostItem[]> {
    return await db.select().from(projectCostItems)
      .where(eq(projectCostItems.projectId, projectId))
      .orderBy(asc(projectCostItems.sortOrder), asc(projectCostItems.createdAt));
  }

  async createProjectCostItem(item: InsertProjectCostItem): Promise<ProjectCostItem> {
    const result = await db.insert(projectCostItems).values(item).returning();
    return result[0];
  }

  async updateProjectCostItem(id: string, item: Partial<InsertProjectCostItem>): Promise<ProjectCostItem | undefined> {
    const result = await db.update(projectCostItems).set(item).where(eq(projectCostItems.id, id)).returning();
    return result[0];
  }

  async deleteProjectCostItem(id: string): Promise<boolean> {
    const result = await db.delete(projectCostItems).where(eq(projectCostItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Accessories Checklist (Handover Items)
  async getHandoverItems(orgId: string): Promise<HandoverItem[]> {
    return await db.select().from(handoverItems)
      .where(eq(handoverItems.orgId, orgId))
      .orderBy(asc(handoverItems.category), asc(handoverItems.sortOrder), asc(handoverItems.createdAt));
  }

  async createHandoverItem(item: InsertHandoverItem): Promise<HandoverItem> {
    const [result] = await db.insert(handoverItems).values(item).returning();
    return result;
  }

  async updateHandoverItem(id: string, orgId: string, updates: Partial<InsertHandoverItem>): Promise<HandoverItem | undefined> {
    const [result] = await db.update(handoverItems)
      .set(updates)
      .where(and(eq(handoverItems.id, id), eq(handoverItems.orgId, orgId)))
      .returning();
    return result;
  }

  async deleteHandoverItem(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(handoverItems)
      .where(and(eq(handoverItems.id, id), eq(handoverItems.orgId, orgId)));
    return (result.rowCount ?? 0) > 0;
  }

  async bulkCreateHandoverItems(items: InsertHandoverItem[]): Promise<HandoverItem[]> {
    if (items.length === 0) return [];
    return await db.insert(handoverItems).values(items).returning();
  }

  // Organisations
  async createOrganisation(org: InsertOrganisation): Promise<Organisation> {
    const result = await db.insert(organisations).values(org).returning();
    return result[0];
  }

  async getOrganisation(id: string): Promise<Organisation | undefined> {
    const result = await db.select().from(organisations).where(eq(organisations.id, id));
    return result[0];
  }

  async getOrganisationBySlug(slug: string): Promise<Organisation | undefined> {
    const result = await db.select().from(organisations).where(eq(organisations.slug, slug));
    return result[0];
  }

  async getOrganisationByStripeCustomerId(customerId: string): Promise<Organisation | undefined> {
    const result = await db.select().from(organisations).where(eq(organisations.stripeCustomerId, customerId));
    return result[0];
  }

  async updateOrganisation(id: string, updates: Partial<InsertOrganisation>): Promise<Organisation | undefined> {
    const result = await db.update(organisations).set(updates).where(eq(organisations.id, id)).returning();
    return result[0];
  }

  async getOrgsNearTrialExpiry(withinDays: number, notifiedWithinDays: number): Promise<Organisation[]> {
    const now = new Date();
    const windowEnd = new Date(Date.now() + withinDays * 86_400_000);
    const suppressBefore = new Date(Date.now() - notifiedWithinDays * 86_400_000);
    const trialDurationMs = TRIAL_DURATION_DAYS * 86_400_000;

    const rows = await db
      .select()
      .from(organisations)
      .where(
        and(
          eq(organisations.plan, "trial"),
          eq(organisations.planStatus, "trialing"),
          // Trial must end within the warning window AND must not already be expired
          or(
            and(
              sql`${organisations.currentPeriodEnd} IS NOT NULL`,
              sql`${organisations.currentPeriodEnd} >= ${now}`,
              sql`${organisations.currentPeriodEnd} <= ${windowEnd}`
            ),
            and(
              isNull(organisations.currentPeriodEnd),
              sql`${organisations.createdAt} + ${trialDurationMs} * INTERVAL '1 millisecond' >= ${now}`,
              sql`${organisations.createdAt} + ${trialDurationMs} * INTERVAL '1 millisecond' <= ${windowEnd}`
            )
          ),
          // Suppress if already notified within the suppression window
          or(
            isNull(organisations.trialExpiryNotifiedAt),
            sql`${organisations.trialExpiryNotifiedAt} < ${suppressBefore}`
          )
        )
      );
    return rows;
  }

  async markOrgTrialExpiryNotified(orgId: string, notifiedAt: Date): Promise<void> {
    await db
      .update(organisations)
      .set({ trialExpiryNotifiedAt: notifiedAt })
      .where(eq(organisations.id, orgId));
  }

  // Invitations
  async createInvitation(inv: InsertInvitation): Promise<Invitation> {
    const result = await db.insert(invitations).values(inv).returning();
    return result[0];
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const result = await db.select().from(invitations).where(eq(invitations.token, token));
    return result[0];
  }

  async getInvitationsByOrg(orgId: string): Promise<Invitation[]> {
    return await db.select().from(invitations)
      .where(eq(invitations.orgId, orgId))
      .orderBy(desc(invitations.createdAt));
  }

  async revokeInvitation(id: string): Promise<boolean> {
    const result = await db.delete(invitations).where(eq(invitations.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async acceptInvitation(token: string): Promise<Invitation | undefined> {
    const result = await db.update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.token, token))
      .returning();
    return result[0];
  }

  async updateInvitationToken(id: string, token: string, expiresAt: Date): Promise<Invitation | undefined> {
    const result = await db.update(invitations)
      .set({ token, expiresAt })
      .where(eq(invitations.id, id))
      .returning();
    return result[0];
  }

  // User onboarding
  async completeOnboarding(userId: string): Promise<void> {
    await db.update(users)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async setUserOrgId(userId: string, orgId: string): Promise<void> {
    await db.update(users)
      .set({ orgId })
      .where(eq(users.id, userId));
  }

  async registerOrgWithAdmin(params: {
    orgName: string;
    slug: string;
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    passwordHash: string;
    verificationToken: string;
  }): Promise<{ org: Organisation; user: User }> {
    return await db.transaction(async (tx) => {
      const [org] = await tx.insert(organisations).values({
        name: params.orgName,
        slug: params.slug,
        plan: "trial",
      }).returning();

      const [user] = await tx.insert(users).values({
        id: params.userId,
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        passwordHash: params.passwordHash,
        emailVerificationToken: params.verificationToken,
        emailVerifiedAt: null,
        orgId: org.id,
      }).returning();

      await tx.insert(userRoles).values({
        userId: user.id,
        role: "admin",
        isActive: true,
        assignedBy: user.id,
      });

      return { org, user };
    });
  }

  async getOrgUsage(orgId: string): Promise<{ projects: number; users: number; catalogueItems: number; storageGb: number }> {
    // Helper: sum file_size (in bytes) for a table joined to projects via projectId
    const orgProjectIds = db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    const [projectCount, activeUserCount, pendingInviteCount, catalogueCount, storageBytesResult] = await Promise.all([
      // Projects: count projects directly tagged to this org.
      db.select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.orgId, orgId))
        .then(r => Number(r[0]?.count ?? 0)),
      // Active users: members already in the org, excluding vendor-role accounts.
      db.execute(sql`
        SELECT count(*)::int AS count
        FROM users u
        WHERE u.org_id = ${orgId}
        AND NOT EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = u.id
          AND ur.is_active = true
          AND ur.role = 'vendor'
        )
      `).then(r => Number((r.rows[0] as any)?.count ?? 0)),
      // Pending invitations: counted toward seat quota to prevent bypass-by-invite.
      // Vendor invitations are excluded — they don't occupy a seat.
      db.select({ count: sql<number>`count(*)::int` })
        .from(invitations)
        .where(and(
          eq(invitations.orgId, orgId),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, sql`now()`),
          ne(invitations.role, 'vendor'),
        ))
        .then(r => Number(r[0]?.count ?? 0)),
      // Catalogue items: items tagged to this org.
      db.select({ count: sql<number>`count(*)::int` })
        .from(catalogueItems)
        .where(eq(catalogueItems.orgId, orgId))
        .then(r => Number(r[0]?.count ?? 0)),
      // Storage: sum file_size (bytes) across all org-scoped upload tables.
      // All joins go via projects.orgId (stamped on creation) or user.orgId.
      // Legacy rows with orgId=NULL are excluded — they don't count against new-org quotas.
      db.execute(sql`
        SELECT COALESCE(SUM(bytes), 0)::bigint AS total_bytes FROM (
          -- Floor plans linked to org's projects
          SELECT COALESCE(fp.file_size, 0) AS bytes
          FROM floor_plans fp
          WHERE fp.project_id IN (${orgProjectIds})
          UNION ALL
          -- Moodboards / renders / working drawings linked to org's projects
          SELECT COALESCE(mb.file_size, 0)
          FROM moodboards mb
          WHERE mb.project_id IN (${orgProjectIds})
          UNION ALL
          -- Project schedule files linked to org's projects
          SELECT COALESCE(ps.file_size, 0)
          FROM project_schedules ps
          WHERE ps.project_id IN (${orgProjectIds})
          UNION ALL
          -- Meeting minutes files linked to org's projects
          SELECT COALESCE(mm.file_size, 0)
          FROM meeting_minutes mm
          WHERE mm.project_id IN (${orgProjectIds})
          UNION ALL
          -- Quote files: project_vendors → projects
          SELECT COALESCE(qf.file_size, 0)
          FROM quote_files qf
          INNER JOIN project_vendors pv ON qf.project_vendor_id = pv.id
          WHERE pv.project_id IN (${orgProjectIds})
          UNION ALL
          -- Works-order files: works_orders → project_vendors → projects
          -- file_size is stored as text in works_order_files; cast to numeric for UNION ALL compatibility
          SELECT COALESCE(wof.file_size::numeric, 0)
          FROM works_order_files wof
          INNER JOIN works_orders wo ON wof.works_order_id = wo.id
          INNER JOIN project_vendors pv2 ON wo.project_vendor_id = pv2.id
          WHERE pv2.project_id IN (${orgProjectIds})
          UNION ALL
          -- Works-order templates created by any member of this org
          -- Note: saved_assets has no file_size column; the source file size is captured
          -- via the objectAssets or quoteFiles rows which are already counted above.
          SELECT COALESCE(wt.file_size, 0)
          FROM works_order_templates wt
          INNER JOIN users u2 ON wt.created_by = u2.id
          WHERE u2.org_id = ${orgId}
        ) sub
      `),
    ]);

    const totalBytes = Number((storageBytesResult.rows[0] as any)?.total_bytes ?? 0);
    const storageGb = parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(3));

    return {
      projects: projectCount,
      users: activeUserCount + pendingInviteCount,
      catalogueItems: catalogueCount,
      storageGb,
    };
  }

  async getAllOrganisationsWithStats(): Promise<Array<Organisation & { userCount: number; projectCount: number; lastActivityAt: string | null; storageGb: number }>> {
    const orgs = await db.select().from(organisations).orderBy(desc(organisations.createdAt));
    const results = await Promise.all(orgs.map(async (org) => {
      const [userCountResult, projectCountResult, lastActivityResult, usage] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(users).where(eq(users.orgId, org.id)),
        db.select({ count: sql<number>`COUNT(*)` }).from(projects).where(eq(projects.orgId, org.id)),
        db.select({ createdAt: activityLog.createdAt })
          .from(activityLog)
          .innerJoin(users, eq(activityLog.userId, users.id))
          .where(eq(users.orgId, org.id))
          .orderBy(desc(activityLog.createdAt))
          .limit(1),
        this.getOrgUsage(org.id),
      ]);
      return {
        ...org,
        userCount: Number(userCountResult[0]?.count ?? 0),
        projectCount: Number(projectCountResult[0]?.count ?? 0),
        lastActivityAt: lastActivityResult[0]?.createdAt?.toISOString() ?? null,
        storageGb: usage.storageGb,
      };
    }));
    return results;
  }

  async writeSuperAdminAuditLog(entry: InsertSuperadminAuditLog): Promise<SuperadminAuditLog> {
    const result = await db.insert(superadminAuditLog).values(entry).returning();
    return result[0];
  }

  async getSuperAdminAuditLogs(limit = 100): Promise<SuperadminAuditLog[]> {
    return await db.select().from(superadminAuditLog)
      .orderBy(desc(superadminAuditLog.createdAt))
      .limit(limit);
  }

  async setUserSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<void> {
    await db.update(users).set({ isSuperAdmin }).where(eq(users.id, userId));
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const result = await db.select({ notificationPreferences: users.notificationPreferences })
      .from(users).where(eq(users.id, userId));
    return parseNotificationPreferences(result[0]?.notificationPreferences);
  }

  async updateNotificationPreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getNotificationPreferences(userId);
    const updated = { ...current, ...prefs };
    await db.update(users)
      .set({ notificationPreferences: updated, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return updated;
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; notificationEmail?: string | null }): Promise<User> {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!result[0]) throw new Error("User not found");
    return result[0];
  }

  async getUserByUnsubscribeToken(token: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.unsubscribeToken, token));
    return result[0];
  }

  async updateTrialBannerSnooze(userId: string, snoozedUntil: Date | null, snoozeDuration?: string | null): Promise<void> {
    await db.update(users)
      .set({ trialBannerSnoozedUntil: snoozedUntil, trialBannerSnoozeDuration: snoozeDuration ?? null, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getTrialBannerSnooze(userId: string): Promise<{ snoozedUntil: Date | null; snoozeDuration: string | null }> {
    const result = await db
      .select({ trialBannerSnoozedUntil: users.trialBannerSnoozedUntil, trialBannerSnoozeDuration: users.trialBannerSnoozeDuration })
      .from(users)
      .where(eq(users.id, userId));
    return {
      snoozedUntil: result[0]?.trialBannerSnoozedUntil ?? null,
      snoozeDuration: result[0]?.trialBannerSnoozeDuration ?? null,
    };
  }

  async getOrCreateUnsubscribeToken(userId: string): Promise<string> {
    const newToken = randomUUID();
    // Atomically set unsubscribe_token only if it is currently NULL, then read
    // the final value. This prevents race conditions where concurrent calls
    // could overwrite each other's tokens and invalidate already-sent links.
    await db
      .update(users)
      .set({ unsubscribeToken: newToken, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.unsubscribeToken)));
    const result = await db
      .select({ unsubscribeToken: users.unsubscribeToken })
      .from(users)
      .where(eq(users.id, userId));
    if (!result[0]) throw new Error("User not found");
    if (!result[0].unsubscribeToken) throw new Error("Failed to assign unsubscribe token");
    return result[0].unsubscribeToken;
  }

  // Working Drawings
  async getRoomsForProject(orgId: string, projectId: string): Promise<Array<Room & { drawingCount: number }>> {
    const result = await db
      .select({
        ...getTableColumns(rooms),
        drawingCount: sql<number>`cast(count(${drawings.id}) as int)`,
      })
      .from(rooms)
      .leftJoin(drawings, eq(drawings.roomId, rooms.id))
      .where(and(eq(rooms.orgId, orgId), eq(rooms.projectId, projectId)))
      .groupBy(rooms.id)
      .orderBy(asc(rooms.displayOrder), asc(rooms.name));
    return result;
  }

  async getDrawingsForProject(orgId: string | null, projectId: string, search?: string, drawingType?: string): Promise<Array<Drawing & { latestRevision: DrawingRevision | null; room: Room | null }>> {
    const dr = drawingRevisions;
    const term = search ? '%' + search.toLowerCase() + '%' : null;
    const typeFilter = drawingType || 'working';
    const allDrawings = await db
      .select({
        drawing: getTableColumns(drawings),
        room: getTableColumns(rooms),
      })
      .from(drawings)
      .leftJoin(rooms, eq(drawings.roomId, rooms.id))
      .where(
        and(
          orgId ? eq(drawings.orgId, orgId) : undefined,
          eq(drawings.projectId, projectId),
          eq(drawings.drawingType, typeFilter),
          term ? or(
            sql`lower(${drawings.title}) like ${term}`,
            sql`lower(${drawings.category}) like ${term}`,
            sql`lower(coalesce(${rooms.name},'')) like ${term}`,
          ) : undefined,
        )
      )
      .orderBy(asc(drawings.category), asc(drawings.title));

    if (allDrawings.length === 0) return [];

    const drawingIds = allDrawings.map(r => r.drawing.id);
    const revisions = await db
      .select()
      .from(dr)
      .where(inArray(dr.drawingId, drawingIds))
      .orderBy(asc(dr.drawingId), desc(dr.revisionLetter));

    const latestRevMap = new Map<string, DrawingRevision>();
    for (const rev of revisions) {
      if (!latestRevMap.has(rev.drawingId)) latestRevMap.set(rev.drawingId, rev);
    }

    return allDrawings.map(r => ({
      ...r.drawing,
      latestRevision: latestRevMap.get(r.drawing.id) ?? null,
      room: r.room ?? null,
    }));
  }

  async createRoom(orgId: string, projectId: string, data: { name: string; roomType: string }): Promise<Room> {
    const [maxRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${rooms.displayOrder}), 0)` })
      .from(rooms)
      .where(and(eq(rooms.orgId, orgId), eq(rooms.projectId, projectId)));
    const nextOrder = (maxRow?.maxOrder ?? 0) + 1;
    const [result] = await db.insert(rooms).values({
      id: randomUUID(),
      orgId,
      projectId,
      name: data.name,
      roomType: data.roomType,
      displayOrder: nextOrder,
    }).returning();
    return result;
  }

  async updateRoom(id: string, orgId: string, data: { name: string; roomType: string }): Promise<Room | undefined> {
    const [result] = await db
      .update(rooms)
      .set({ name: data.name, roomType: data.roomType, updatedAt: new Date() })
      .where(and(eq(rooms.id, id), eq(rooms.orgId, orgId)))
      .returning();
    return result;
  }

  async deleteRoom(id: string, orgId: string, projectId: string): Promise<{ success: boolean; drawingCount: number }> {
    const [countRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(drawings)
      .where(and(eq(drawings.roomId, id), eq(drawings.orgId, orgId), eq(drawings.projectId, projectId)));
    const drawingCount = countRow?.count ?? 0;
    if (drawingCount > 0) return { success: false, drawingCount };
    await db.delete(rooms).where(and(eq(rooms.id, id), eq(rooms.orgId, orgId)));
    return { success: true, drawingCount: 0 };
  }

  async updateDrawing(id: string, orgId: string, data: { title?: string; roomId?: string | null; category?: string }): Promise<Drawing | undefined> {
    const [result] = await db
      .update(drawings)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(drawings.id, id), eq(drawings.orgId, orgId)))
      .returning();
    return result;
  }
}

export const storage = new DBStorage();
