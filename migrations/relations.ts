import { relations } from "drizzle-orm/relations";
import { projectVendors, quoteFiles, projects, floorPlans, boq, vendorCategories, vendors, quoteTemplates, users, userRoles, designerAllowlist } from "./schema";

export const quoteFilesRelations = relations(quoteFiles, ({one}) => ({
	projectVendor: one(projectVendors, {
		fields: [quoteFiles.projectVendorId],
		references: [projectVendors.id]
	}),
}));

export const projectVendorsRelations = relations(projectVendors, ({one, many}) => ({
	quoteFiles: many(quoteFiles),
	boqs: many(boq),
	project: one(projects, {
		fields: [projectVendors.projectId],
		references: [projects.id]
	}),
	vendor: one(vendors, {
		fields: [projectVendors.vendorId],
		references: [vendors.id]
	}),
	quoteTemplate: one(quoteTemplates, {
		fields: [projectVendors.templateId],
		references: [quoteTemplates.id]
	}),
	projectVendor: one(projectVendors, {
		fields: [projectVendors.parentQuotationId],
		references: [projectVendors.id],
		relationName: "projectVendors_parentQuotationId_projectVendors_id"
	}),
	projectVendors: many(projectVendors, {
		relationName: "projectVendors_parentQuotationId_projectVendors_id"
	}),
}));

export const floorPlansRelations = relations(floorPlans, ({one}) => ({
	project: one(projects, {
		fields: [floorPlans.projectId],
		references: [projects.id]
	}),
}));

export const projectsRelations = relations(projects, ({many}) => ({
	floorPlans: many(floorPlans),
	projectVendors: many(projectVendors),
}));

export const boqRelations = relations(boq, ({one}) => ({
	projectVendor: one(projectVendors, {
		fields: [boq.projectVendorId],
		references: [projectVendors.id]
	}),
}));

export const vendorsRelations = relations(vendors, ({one, many}) => ({
	vendorCategory: one(vendorCategories, {
		fields: [vendors.categoryId],
		references: [vendorCategories.id]
	}),
	projectVendors: many(projectVendors),
}));

export const vendorCategoriesRelations = relations(vendorCategories, ({many}) => ({
	vendors: many(vendors),
	quoteTemplates: many(quoteTemplates),
}));

export const quoteTemplatesRelations = relations(quoteTemplates, ({one, many}) => ({
	vendorCategory: one(vendorCategories, {
		fields: [quoteTemplates.categoryId],
		references: [vendorCategories.id]
	}),
	projectVendors: many(projectVendors),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	userRoles: many(userRoles),
	designerAllowlists: many(designerAllowlist),
}));

export const designerAllowlistRelations = relations(designerAllowlist, ({one}) => ({
	user: one(users, {
		fields: [designerAllowlist.addedBy],
		references: [users.id]
	}),
}));