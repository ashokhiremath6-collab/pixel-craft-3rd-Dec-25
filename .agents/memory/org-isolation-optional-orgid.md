---
name: Org isolation pattern for optional-orgId storage methods
description: How to scope list/fetch storage methods to an org without breaking backward compatibility
---

All "list all" storage methods now accept an optional `orgId?: string | null` parameter. When truthy, a `WHERE org_id = $orgId` clause is added. When falsy (null/undefined), the full table is returned (safe for MemStorage stubs or internal calls that don't need scoping).

**Why:** Migrations 0042 and 0043 backfilled orgId on all legacy rows, so a strict `eq(table.orgId, orgId)` filter is safe — no `OR orgId IS NULL` fallback needed for these tables.

**How to apply:**
- Storage interface: `getAllFoo(orgId?: string | null): Promise<Foo[]>`
- DatabaseStorage impl: `if (orgId) return await db.select().from(foo).where(eq(foo.orgId, orgId))...`
- Route handler: `const orgId = (req.user as any).orgId ?? null; storage.getAllFoo(orgId)`
- MemStorage stub: just accept the param and ignore it (returns [] or in-memory set unchanged)

**Methods updated in this session:**
getAllQuoteTemplates, getMoodboardsForUser, getAllCatalogueItems, getCatalogueItemsByCategory,
getMainCategories, getCategoriesWithImageCounts, getCatalogueItemsCount, getAllSpecifications,
getSpecificationsByCategory, getSpecificationCategories, getAllSops, getSopsByCategory,
getSopCategories, getAllSavedAssets
