import { relations } from "drizzle-orm/relations";
import { projects, activityLog, users, approvals, tasks, vendorCategories, projectVendors, quoteTemplates, vendors, boq, designerAllowlist, favoriteRenderStyles, floorPlans, meetingMinutes, meetingActionItems, moodboards, catalogueItems, objectAssets, projectClients, projectSchedules, quoteFiles, savedAssets, taskAlerts, taskDependencies, userProjectAssignments, userRoles, vendorContacts, vendorInvoices, vendorPayments, worksOrderDocuments, worksOrders, worksOrderFiles, worksOrderItems, worksOrderSignatures, worksOrderTemplates, sops, superadminAuditLog, organisations } from "./schema";

export const activityLogRelations = relations(activityLog, ({one}) => ({
	project: one(projects, {
		fields: [activityLog.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [activityLog.userId],
		references: [users.id]
	}),
}));

export const projectsRelations = relations(projects, ({many}) => ({
	activityLogs: many(activityLog),
	projectVendors: many(projectVendors),
	floorPlans: many(floorPlans),
	meetingMinutes: many(meetingMinutes),
	moodboards: many(moodboards),
	projectClients: many(projectClients),
	projectSchedules: many(projectSchedules),
	userProjectAssignments: many(userProjectAssignments),
	vendorInvoices: many(vendorInvoices),
	tasks: many(tasks),
}));

export const usersRelations = relations(users, ({many}) => ({
	activityLogs: many(activityLog),
	approvals_approverId: many(approvals, {
		relationName: "approvals_approverId_users_id"
	}),
	approvals_requestedBy: many(approvals, {
		relationName: "approvals_requestedBy_users_id"
	}),
	designerAllowlists: many(designerAllowlist),
	favoriteRenderStyles: many(favoriteRenderStyles),
	meetingMinutes: many(meetingMinutes),
	moodboards: many(moodboards),
	objectAssets: many(objectAssets),
	savedAssets: many(savedAssets),
	taskAlerts: many(taskAlerts),
	userProjectAssignments_assignedBy: many(userProjectAssignments, {
		relationName: "userProjectAssignments_assignedBy_users_id"
	}),
	userProjectAssignments_userId: many(userProjectAssignments, {
		relationName: "userProjectAssignments_userId_users_id"
	}),
	userRoles: many(userRoles),
	worksOrderDocuments: many(worksOrderDocuments),
	worksOrders: many(worksOrders),
	worksOrderSignatures: many(worksOrderSignatures),
	worksOrderTemplates: many(worksOrderTemplates),
	tasks_approvedBy: many(tasks, {
		relationName: "tasks_approvedBy_users_id"
	}),
	tasks_assignedTo: many(tasks, {
		relationName: "tasks_assignedTo_users_id"
	}),
	sops: many(sops),
	superadminAuditLogs_superAdminId: many(superadminAuditLog, {
		relationName: "superadminAuditLog_superAdminId_users_id"
	}),
	superadminAuditLogs_targetUserId: many(superadminAuditLog, {
		relationName: "superadminAuditLog_targetUserId_users_id"
	}),
}));

export const approvalsRelations = relations(approvals, ({one}) => ({
	user_approverId: one(users, {
		fields: [approvals.approverId],
		references: [users.id],
		relationName: "approvals_approverId_users_id"
	}),
	user_requestedBy: one(users, {
		fields: [approvals.requestedBy],
		references: [users.id],
		relationName: "approvals_requestedBy_users_id"
	}),
	task: one(tasks, {
		fields: [approvals.taskId],
		references: [tasks.id]
	}),
}));

export const tasksRelations = relations(tasks, ({one, many}) => ({
	approvals: many(approvals),
	taskAlerts: many(taskAlerts),
	taskDependencies_fromTaskId: many(taskDependencies, {
		relationName: "taskDependencies_fromTaskId_tasks_id"
	}),
	taskDependencies_toTaskId: many(taskDependencies, {
		relationName: "taskDependencies_toTaskId_tasks_id"
	}),
	user_approvedBy: one(users, {
		fields: [tasks.approvedBy],
		references: [users.id],
		relationName: "tasks_approvedBy_users_id"
	}),
	user_assignedTo: one(users, {
		fields: [tasks.assignedTo],
		references: [users.id],
		relationName: "tasks_assignedTo_users_id"
	}),
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.id]
	}),
	projectSchedule: one(projectSchedules, {
		fields: [tasks.scheduleId],
		references: [projectSchedules.id]
	}),
}));

export const projectVendorsRelations = relations(projectVendors, ({one, many}) => ({
	vendorCategory: one(vendorCategories, {
		fields: [projectVendors.categoryId],
		references: [vendorCategories.id]
	}),
	projectVendor: one(projectVendors, {
		fields: [projectVendors.parentQuotationId],
		references: [projectVendors.id],
		relationName: "projectVendors_parentQuotationId_projectVendors_id"
	}),
	projectVendors: many(projectVendors, {
		relationName: "projectVendors_parentQuotationId_projectVendors_id"
	}),
	project: one(projects, {
		fields: [projectVendors.projectId],
		references: [projects.id]
	}),
	quoteTemplate: one(quoteTemplates, {
		fields: [projectVendors.templateId],
		references: [quoteTemplates.id]
	}),
	vendor: one(vendors, {
		fields: [projectVendors.vendorId],
		references: [vendors.id]
	}),
	boqs: many(boq),
	quoteFiles: many(quoteFiles),
	worksOrders: many(worksOrders),
	worksOrderItems: many(worksOrderItems),
}));

export const vendorCategoriesRelations = relations(vendorCategories, ({many}) => ({
	projectVendors: many(projectVendors),
	quoteTemplates: many(quoteTemplates),
	vendors: many(vendors),
	worksOrderTemplates: many(worksOrderTemplates),
}));

export const quoteTemplatesRelations = relations(quoteTemplates, ({one, many}) => ({
	projectVendors: many(projectVendors),
	vendorCategory: one(vendorCategories, {
		fields: [quoteTemplates.categoryId],
		references: [vendorCategories.id]
	}),
}));

export const vendorsRelations = relations(vendors, ({one, many}) => ({
	projectVendors: many(projectVendors),
	vendorCategory: one(vendorCategories, {
		fields: [vendors.categoryId],
		references: [vendorCategories.id]
	}),
	vendorContacts: many(vendorContacts),
	vendorInvoices: many(vendorInvoices),
	vendorPayments: many(vendorPayments),
}));

export const boqRelations = relations(boq, ({one}) => ({
	projectVendor: one(projectVendors, {
		fields: [boq.projectVendorId],
		references: [projectVendors.id]
	}),
}));

export const designerAllowlistRelations = relations(designerAllowlist, ({one}) => ({
	user: one(users, {
		fields: [designerAllowlist.addedBy],
		references: [users.id]
	}),
}));

export const favoriteRenderStylesRelations = relations(favoriteRenderStyles, ({one}) => ({
	user: one(users, {
		fields: [favoriteRenderStyles.userId],
		references: [users.id]
	}),
}));

export const floorPlansRelations = relations(floorPlans, ({one}) => ({
	project: one(projects, {
		fields: [floorPlans.projectId],
		references: [projects.id]
	}),
}));

export const meetingMinutesRelations = relations(meetingMinutes, ({one, many}) => ({
	project: one(projects, {
		fields: [meetingMinutes.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [meetingMinutes.uploadedBy],
		references: [users.id]
	}),
	meetingActionItems: many(meetingActionItems),
}));

export const meetingActionItemsRelations = relations(meetingActionItems, ({one}) => ({
	meetingMinute: one(meetingMinutes, {
		fields: [meetingActionItems.meetingMinutesId],
		references: [meetingMinutes.id]
	}),
}));

export const moodboardsRelations = relations(moodboards, ({one}) => ({
	project: one(projects, {
		fields: [moodboards.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [moodboards.savedBy],
		references: [users.id]
	}),
}));

export const objectAssetsRelations = relations(objectAssets, ({one, many}) => ({
	catalogueItem: one(catalogueItems, {
		fields: [objectAssets.catalogueItemId],
		references: [catalogueItems.id]
	}),
	user: one(users, {
		fields: [objectAssets.uploadedBy],
		references: [users.id]
	}),
	savedAssets: many(savedAssets),
}));

export const catalogueItemsRelations = relations(catalogueItems, ({many}) => ({
	objectAssets: many(objectAssets),
	savedAssets: many(savedAssets),
}));

export const projectClientsRelations = relations(projectClients, ({one}) => ({
	project: one(projects, {
		fields: [projectClients.projectId],
		references: [projects.id]
	}),
}));

export const projectSchedulesRelations = relations(projectSchedules, ({one, many}) => ({
	project: one(projects, {
		fields: [projectSchedules.projectId],
		references: [projects.id]
	}),
	tasks: many(tasks),
}));

export const quoteFilesRelations = relations(quoteFiles, ({one, many}) => ({
	projectVendor: one(projectVendors, {
		fields: [quoteFiles.projectVendorId],
		references: [projectVendors.id]
	}),
	worksOrders: many(worksOrders),
}));

export const savedAssetsRelations = relations(savedAssets, ({one}) => ({
	catalogueItem: one(catalogueItems, {
		fields: [savedAssets.catalogueItemId],
		references: [catalogueItems.id]
	}),
	objectAsset: one(objectAssets, {
		fields: [savedAssets.objectAssetId],
		references: [objectAssets.id]
	}),
	user: one(users, {
		fields: [savedAssets.savedBy],
		references: [users.id]
	}),
}));

export const taskAlertsRelations = relations(taskAlerts, ({one}) => ({
	task: one(tasks, {
		fields: [taskAlerts.taskId],
		references: [tasks.id]
	}),
	user: one(users, {
		fields: [taskAlerts.userId],
		references: [users.id]
	}),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({one}) => ({
	task_fromTaskId: one(tasks, {
		fields: [taskDependencies.fromTaskId],
		references: [tasks.id],
		relationName: "taskDependencies_fromTaskId_tasks_id"
	}),
	task_toTaskId: one(tasks, {
		fields: [taskDependencies.toTaskId],
		references: [tasks.id],
		relationName: "taskDependencies_toTaskId_tasks_id"
	}),
}));

export const userProjectAssignmentsRelations = relations(userProjectAssignments, ({one}) => ({
	user_assignedBy: one(users, {
		fields: [userProjectAssignments.assignedBy],
		references: [users.id],
		relationName: "userProjectAssignments_assignedBy_users_id"
	}),
	project: one(projects, {
		fields: [userProjectAssignments.projectId],
		references: [projects.id]
	}),
	user_userId: one(users, {
		fields: [userProjectAssignments.userId],
		references: [users.id],
		relationName: "userProjectAssignments_userId_users_id"
	}),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));

export const vendorContactsRelations = relations(vendorContacts, ({one}) => ({
	vendor: one(vendors, {
		fields: [vendorContacts.vendorId],
		references: [vendors.id]
	}),
}));

export const vendorInvoicesRelations = relations(vendorInvoices, ({one}) => ({
	project: one(projects, {
		fields: [vendorInvoices.projectId],
		references: [projects.id]
	}),
	vendor: one(vendors, {
		fields: [vendorInvoices.vendorId],
		references: [vendors.id]
	}),
}));

export const vendorPaymentsRelations = relations(vendorPayments, ({one}) => ({
	vendor: one(vendors, {
		fields: [vendorPayments.vendorId],
		references: [vendors.id]
	}),
}));

export const worksOrderDocumentsRelations = relations(worksOrderDocuments, ({one}) => ({
	user: one(users, {
		fields: [worksOrderDocuments.uploadedBy],
		references: [users.id]
	}),
	worksOrder: one(worksOrders, {
		fields: [worksOrderDocuments.worksOrderId],
		references: [worksOrders.id]
	}),
}));

export const worksOrdersRelations = relations(worksOrders, ({one, many}) => ({
	worksOrderDocuments: many(worksOrderDocuments),
	user: one(users, {
		fields: [worksOrders.createdBy],
		references: [users.id]
	}),
	projectVendor: one(projectVendors, {
		fields: [worksOrders.projectVendorId],
		references: [projectVendors.id]
	}),
	quoteFile: one(quoteFiles, {
		fields: [worksOrders.quoteFileId],
		references: [quoteFiles.id]
	}),
	worksOrderFiles: many(worksOrderFiles),
	worksOrderItems_sourceWorksOrderId: many(worksOrderItems, {
		relationName: "worksOrderItems_sourceWorksOrderId_worksOrders_id"
	}),
	worksOrderItems_worksOrderId: many(worksOrderItems, {
		relationName: "worksOrderItems_worksOrderId_worksOrders_id"
	}),
	worksOrderSignatures: many(worksOrderSignatures),
}));

export const worksOrderFilesRelations = relations(worksOrderFiles, ({one}) => ({
	worksOrder: one(worksOrders, {
		fields: [worksOrderFiles.worksOrderId],
		references: [worksOrders.id]
	}),
}));

export const worksOrderItemsRelations = relations(worksOrderItems, ({one}) => ({
	projectVendor: one(projectVendors, {
		fields: [worksOrderItems.sourceProjectVendorId],
		references: [projectVendors.id]
	}),
	worksOrder_sourceWorksOrderId: one(worksOrders, {
		fields: [worksOrderItems.sourceWorksOrderId],
		references: [worksOrders.id],
		relationName: "worksOrderItems_sourceWorksOrderId_worksOrders_id"
	}),
	worksOrder_worksOrderId: one(worksOrders, {
		fields: [worksOrderItems.worksOrderId],
		references: [worksOrders.id],
		relationName: "worksOrderItems_worksOrderId_worksOrders_id"
	}),
}));

export const worksOrderSignaturesRelations = relations(worksOrderSignatures, ({one}) => ({
	user: one(users, {
		fields: [worksOrderSignatures.signerId],
		references: [users.id]
	}),
	worksOrder: one(worksOrders, {
		fields: [worksOrderSignatures.worksOrderId],
		references: [worksOrders.id]
	}),
}));

export const worksOrderTemplatesRelations = relations(worksOrderTemplates, ({one}) => ({
	vendorCategory: one(vendorCategories, {
		fields: [worksOrderTemplates.categoryId],
		references: [vendorCategories.id]
	}),
	user: one(users, {
		fields: [worksOrderTemplates.createdBy],
		references: [users.id]
	}),
}));

export const sopsRelations = relations(sops, ({one}) => ({
	user: one(users, {
		fields: [sops.createdBy],
		references: [users.id]
	}),
}));

export const superadminAuditLogRelations = relations(superadminAuditLog, ({one}) => ({
	user_superAdminId: one(users, {
		fields: [superadminAuditLog.superAdminId],
		references: [users.id],
		relationName: "superadminAuditLog_superAdminId_users_id"
	}),
	organisation: one(organisations, {
		fields: [superadminAuditLog.targetOrgId],
		references: [organisations.id]
	}),
	user_targetUserId: one(users, {
		fields: [superadminAuditLog.targetUserId],
		references: [users.id],
		relationName: "superadminAuditLog_targetUserId_users_id"
	}),
}));

export const organisationsRelations = relations(organisations, ({many}) => ({
	superadminAuditLogs: many(superadminAuditLog),
}));