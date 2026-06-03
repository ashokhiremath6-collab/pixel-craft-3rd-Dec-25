---
name: Replit proxy WAF blocks assetType query param
description: Replit deployment proxy returns 403 HTML for GET requests with assetType query parameter; use path segments instead.
---

**Rule:** Never put `assetType` (or similarly-named filter params) in the query string of GET requests in Replit deployments. The proxy WAF flags them and returns `403 Forbidden` (HTML page) before the request reaches Express — which means Express logs show zero trace of the request.

**Why:** Replit's autoscale deployment proxy applies WAF rules to query strings. Parameter names/values like `assetType=working_drawing` match injection-detection patterns and get blocked silently.

**How to apply:** When fetching data filtered by a "type" field, put the type in the URL path:
- BAD:  `GET /api/moodboards?projectId=X&assetType=working_drawing`
- GOOD: `GET /api/moodboards/by-type/working_drawing?projectId=X`

Confirmed fix: added `app.get("/api/moodboards/by-type/:type", ...)` and updated frontend to use path-based URL. Works in production (June 2026).
