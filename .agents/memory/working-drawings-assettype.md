---
name: Working drawings assetType detection bug
description: Why working drawings vanished after project selection — assetType derived from location must use startsWith not ===
---

# Working Drawings assetType Detection Bug

## The Rule
In `MoodboardsPage.tsx`, the `assetType` useMemo must use `location.startsWith(...)`, not `location === "..."`.

**Why:** After the user selects a project from the dropdown, `setFilterProjectId` calls wouter's `setLocation` with the full path+query string (e.g. `/working-drawings?projectId=...`). In some render cycles, `useLocation()` may return this full string. The exact equality `location === "/working-drawings"` then fails, `assetType` falls back to `"moodboard"`, and the API query fetches 0 results because all items are stored as `assetType = "working_drawing"`.

**How to apply:** Any time you add or change assetType detection in MoodboardsPage.tsx, always use `startsWith`:
```javascript
if (location.startsWith("/working-drawings")) return "working_drawing";
if (location.startsWith("/renders")) return "render";
return "moodboard";
```

## Secondary Issue
`isLoading` alone is not enough for the loading spinner guard. With `staleTime:0` + `refetchOnMount:always`, background refetches happen with `isFetching=true` and `isLoading=false`. If the stale cache is empty (0 items), the condition `!isLoading && moodboards.length > 0` is false, causing a blank screen until the fetch completes.

Fix: `(isLoading || (isFetching && moodboards.length === 0)) && filterProjectId` for the spinner, and `!isLoading && !(isFetching && moodboards.length === 0) && moodboards.length > 0` for the drawings section.
