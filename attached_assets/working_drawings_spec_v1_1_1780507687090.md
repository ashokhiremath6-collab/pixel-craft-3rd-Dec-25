# Working Drawings System — Design Specification

**Project:** PixelCraft / Olympik Design  
**Author:** Ashok with Claude  
**Status:** Approved for phased implementation  
**Version:** 1.1 (adds rooms concept, 10-prompt plan)

---

## 1. Purpose

Replace the current Working Drawings tab (which treats every upload as a standalone file with a manual "v1.0" label) with a structured system that supports:

- Persistent drawing identities with revision history
- A clear lifecycle (Draft → For Client Review → Approved → Superseded)
- Recorded client approvals with audit trail
- A project-level drawing register showing what exists, what's pending, what's missing
- Comments and activity history on each drawing

The system is designed for a small studio's current workflow but built on a data model that scales to a 50-person firm without rewrite.

---

## 2. Core Concepts

### 2.1 Drawing

A persistent design artefact for a project. Examples: "Master Bathroom Floor Plan," "Kitchen Elevation East," "Living Room Joinery Detail."

A drawing has identity that persists across revisions. The drawing is the thing; revisions are versions of the thing.

### 2.2 Revision

A specific uploaded file representing the drawing at a point in time. Revisions are labelled A, B, C... in order of upload. The latest revision in a given state is the "active" version visible by default.

### 2.3 State

A revision is in one of these states at any time:

- **Draft** — uploaded but not yet sent to client. Only visible to designers, architects, and project managers.
- **For Client Review** — issued to client; client can view and either approve or return with comments.
- **Approved** — client has approved this revision. Locked.
- **Returned with Comments** — client has reviewed and asked for changes. Visible to all internal users.
- **Superseded** — a later revision has been approved. Available in history view but no longer the "active" version.

### 2.4 Approval

A permanent, immutable event recording that a client approved a specific revision at a specific time. Once recorded, an approval cannot be edited or deleted. New approvals on later revisions supersede earlier ones; the earlier approvals remain in the audit trail.

### 2.5 Drawing Register

The project-level view of all drawings. Shows what's planned, what exists, what state each is in, and what's missing per the project template.

### 2.6 Room

A space within a project that drawings can be associated with. Examples: "Master Bedroom," "Kids Bedroom 1," "Master Bathroom," "Kitchen," "Living-Dining."

Rooms are first-class entities for residential and most interior work because:
- Drawings naturally cluster by room (4 elevations per bedroom × 4 bedrooms = 16 elevations)
- The drawing register is most useful when grouped by room
- Templates generate room-aware placeholders
- Future features (per-room moodboards, per-room BOQs, per-room handover) benefit from rooms existing as entities

Rooms have a `room_type` (bedroom, bathroom, kitchen, etc.) which drives what drawings the template expects for that room. Room names are editable — the template populates a default name ("Bedroom 1") which the designer can rename to anything ("Master Bedroom," "Riya's Room").

### 2.7 Project Template

A predefined list of drawings expected for a project type. The template has two levels:
- **Project-level drawings** that exist once per project (overall floor plan, BOQ, specification, schedules)
- **Room-level drawings** that exist per room of each type (elevations per bedroom wall, joinery per wardrobe)

When a project is created with a template, the designer specifies the rooms (count and type), and the template populates the drawing register with both project-level and room-level placeholders. As drawings are uploaded, placeholders are fulfilled. The "missing" indicator shows what's still expected.

---

## 3. Roles and Permissions

Four roles operate within a project. Roles are assigned per-project, not globally, so the same user can be Designer on one project and Architect on another (though this is unusual).

| Role | Can upload drawings | Can issue for review | Can approve | Can view drafts | Can comment |
|------|---------------------|----------------------|-------------|-----------------|-------------|
| Designer | Yes | Yes | No | Yes | Yes |
| Architect | Yes | No | No | Yes | Yes |
| Project Manager | No | No | No | Yes | Yes |
| Client | No | No | Yes | No | Yes |

Notes:
- "Cannot view drafts" for Client is enforced at the API layer, not just UI hiding. Client queries return only revisions in For Client Review, Approved, or Superseded states.
- Multiple users can hold the same role on a project (e.g., husband and wife both as Client).
- For approval, any one user with the Client role can approve. The approval is recorded against that specific user. The system does not require all client users to approve.

---

## 4. Data Model

All tables include `org_id` from creation. All queries filter by `org_id`. This is the multi-tenant pattern locked in earlier in the project and must not be skipped.

### 4.1 `rooms`

Rooms within a project.

- `id` (uuid, primary key)
- `org_id` (uuid, not null, indexed)
- `project_id` (uuid, foreign key to projects, not null, indexed)
- `name` (text, not null) — designer-editable, e.g., "Master Bedroom," "Riya's Room"
- `room_type` (text, not null) — one of the predefined types (see 4.7)
- `display_order` (integer) — for sorting in the register
- `notes` (text, nullable) — optional notes about the room
- `created_by` (uuid, foreign key to users)
- `created_at`, `updated_at` (timestamps)

Constraints:
- Unique (project_id, name) — no two rooms with the same name in a project

### 4.2 `drawings`

The persistent drawing identity.

- `id` (uuid, primary key)
- `org_id` (uuid, not null, indexed)
- `project_id` (uuid, foreign key to projects, not null, indexed)
- `room_id` (uuid, foreign key to rooms, nullable, indexed) — null for project-level drawings; set for room-specific drawings
- `title` (text, not null) — e.g. "Master Bathroom Floor Plan"
- `category` (text, not null) — one of the predefined categories (see 4.8)
- `discipline` (text, default 'Interior') — Architecture, Interior, MEP, Structural, etc. Hidden in UI for now; defaulted to project's primary discipline.
- `drawing_number` (text, nullable) — optional human-readable number like "MT-A-FP-01". Auto-generated per project numbering scheme.
- `description` (text, nullable) — optional notes about the drawing
- `status` (text, not null) — denormalised status of the active revision: 'planned', 'drafting', 'for_review', 'approved', 'superseded'. Used for fast register queries.
- `is_template_placeholder` (boolean, default false) — true if this row was created from a template and no revision has been uploaded yet
- `created_by` (uuid, foreign key to users)
- `created_at`, `updated_at` (timestamps)

Constraints:
- Unique (project_id, room_id, title) — prevents duplicate titles within the same room (or at project level)

### 4.3 `drawing_revisions`

Versions of a drawing.

- `id` (uuid, primary key)
- `org_id` (uuid, not null, indexed)
- `drawing_id` (uuid, foreign key to drawings, not null, indexed)
- `revision_letter` (text, not null) — 'A', 'B', 'C', etc.
- `file_path` (text, not null) — storage path
- `file_name` (text, not null) — original filename for display
- `file_size` (bigint, not null) — bytes
- `file_mime_type` (text, not null) — for rendering preview
- `state` (text, not null) — one of: 'draft', 'for_review', 'approved', 'returned_with_comments', 'superseded'
- `revision_note` (text, nullable) — what changed since the previous revision; required when uploading a new revision after the first
- `uploaded_by` (uuid, foreign key to users)
- `uploaded_at` (timestamp)
- `issued_at` (timestamp, nullable) — when state transitioned to for_review
- `approved_at` (timestamp, nullable) — when state transitioned to approved
- `superseded_at` (timestamp, nullable) — when state transitioned to superseded

Constraints:
- Unique (drawing_id, revision_letter) — no two Revision A's of the same drawing
- Only one revision per drawing can be in state 'approved' or 'for_review' at a time

### 4.4 `drawing_approvals`

Immutable approval audit log.

- `id` (uuid, primary key)
- `org_id` (uuid, not null, indexed)
- `revision_id` (uuid, foreign key to drawing_revisions, not null)
- `approved_by` (uuid, foreign key to users, not null)
- `approved_at` (timestamp, not null)
- `approver_ip` (text) — captured from request
- `approver_user_agent` (text) — captured from request
- `approval_comment` (text, nullable) — optional comment with the approval

This table is append-only. No update or delete operations exist on it. The application code must enforce this; database-level enforcement (via revoking permissions or triggers) is good practice but not required initially.

### 4.5 `revision_events`

Activity stream for revisions. Every meaningful action creates an event.

- `id` (uuid, primary key)
- `org_id` (uuid, not null, indexed)
- `revision_id` (uuid, foreign key to drawing_revisions, not null, indexed)
- `event_type` (text, not null) — see event types below
- `actor_id` (uuid, foreign key to users)
- `created_at` (timestamp, not null)
- `payload` (jsonb, nullable) — event-specific data

Event types (extensible):
- `uploaded` — revision was uploaded
- `issued_for_review` — revision state changed to for_review
- `approved` — revision was approved (links to drawing_approvals.id in payload)
- `returned_with_comments` — client returned with comments
- `superseded` — a later revision was approved
- `comment_added` — comment was added (comment_id in payload)

This table is the foundation for activity feeds, notifications, and audit. Keep it simple now; it accommodates many future features.

### 4.6 `drawing_comments`

Comments on revisions.

- `id` (uuid, primary key)
- `org_id` (uuid, not null, indexed)
- `revision_id` (uuid, foreign key to drawing_revisions, not null, indexed)
- `parent_comment_id` (uuid, foreign key to drawing_comments, nullable) — for threading
- `author_id` (uuid, foreign key to users, not null)
- `body` (text, not null)
- `created_at` (timestamp)
- `edited_at` (timestamp, nullable)

Comments are not deletable from the UI. They can be edited by the author within 15 minutes of creation, then become immutable.

### 4.7 Room type list

Rooms must have one of these types. Stored as text but constrained at the application layer:

- `bedroom` — Master, kids, guest, etc.
- `bathroom` — Master ensuite, common, powder room
- `kitchen`
- `living` — Living room, sitting room
- `dining` — Dining room (when separate from living)
- `family_room` — Family room, den
- `foyer` — Foyer, entrance, lobby
- `study` — Study, home office, library
- `utility` — Utility room, laundry
- `pooja` — Pooja room
- `staff` — Servant room, staff quarters
- `balcony` — Balcony, terrace, deck
- `other` — Catch-all for atypical spaces

Type determines which room-level drawings the template will generate.

### 4.8 Category list

Drawings must have one of these categories. Stored as text but constrained at the application layer to this list:

- Floor Plan
- Reflected Ceiling Plan
- Elevation
- Section
- Joinery Detail
- Electrical Layout
- Plumbing Layout
- HVAC Layout
- Furniture Layout
- Finishes Schedule
- Hardware Schedule
- Door & Window Schedule
- BOQ
- Specification
- Site Plan
- Other

This list lives in code, not the database, so adding categories requires a deploy. That's intentional — it forces a thoughtful decision when adding new categories.

### 4.9 Future tables (not built now, but data model anticipates)

The following tables would be added when scale requires:

- `approval_workflows` and `approval_workflow_steps` — for multi-step approval chains (Internal Review → Client Approval). For now, the single-step "Client Approval" is hardcoded.
- `roles` and `role_permissions` — for custom role definition. For now, four roles are hardcoded.
- `project_templates` and `project_template_drawings` — for template management. For now, two templates are hardcoded ("Residential Interior" and "Office Interior").
- `teams` — for multi-team firms. For now, all users in an org are in one implicit team.

These are documented as future work but explicitly out of scope for this phase. The data model should leave room for them without building them.

---

## 5. State Transitions

The allowed transitions for `drawing_revisions.state`:

```
draft → for_review              (Designer issues for client review)
draft → superseded              (auto, when a later revision is approved while this is still draft)
for_review → approved            (Client approves)
for_review → returned_with_comments  (Client returns with comments)
for_review → draft               (Designer withdraws issue — only if no approval yet)
returned_with_comments → draft  (auto, when designer uploads a new revision in response)
approved → superseded            (auto, when a later revision is approved)
```

Transitions not in this list are not allowed. The application must enforce this; attempts to make invalid transitions should fail with a clear error.

When a revision transitions to `approved`:
- The drawing's `status` column updates to `approved`
- Any previously approved revision of the same drawing transitions to `superseded`
- An event is logged in `revision_events`
- An entry is created in `drawing_approvals` (the immutable audit record)
- If notifications are enabled, the designer and project manager are notified

---

## 6. User Journeys

These flows must work end-to-end. They are the acceptance criteria for the feature.

### 6.1 Designer uploads a new drawing (first time)

1. Designer navigates to a project's Working Drawings page
2. Clicks "New Drawing"
3. Form: title, category, optional description
4. On submit, drawing entity is created with status `drafting`
5. Designer uploads file → Revision A is created in state `draft`
6. Drawing now appears in the project register with status `drafting`

### 6.2 Designer uploads a revision to an existing drawing

1. Designer navigates to the existing drawing
2. Clicks "Upload New Revision"
3. Form: file, revision note (required, free text)
4. On submit, new revision is created with next letter (B, C, etc.) in state `draft`
5. Prior revision retains its state

### 6.3 Designer issues a revision for client review

1. Designer selects a revision in state `draft`
2. Clicks "Issue for Client Review"
3. Confirmation dialog: "This will notify the client and make this revision visible to them. Continue?"
4. On confirm:
   - Revision state changes to `for_review`
   - `issued_at` timestamp set
   - Event logged
   - Notification sent to all users with Client role on this project
   - Drawing status updated to `for_review`

### 6.4 Client reviews a drawing

1. Client logs in, sees notification or sees drawings in "Pending Your Review" list on dashboard
2. Opens the drawing
3. Sees only revisions in states `for_review`, `approved`, or `superseded` (never `draft` or `returned_with_comments`)
4. Can:
   - Add comments (any state)
   - Click "Approve" (only on `for_review` revisions)
   - Click "Return with Comments" (only on `for_review` revisions; requires at least one comment to be added)

### 6.5 Client approves a revision

1. Client clicks "Approve" on a revision in `for_review`
2. Confirmation dialog: "You are approving Revision [X] of [Drawing Title]. This will be recorded as your approval. Continue?"
3. Optional approval comment field
4. On confirm:
   - `drawing_approvals` row created (immutable; captures IP, user-agent, timestamp)
   - Revision state changes to `approved`
   - `approved_at` timestamp set
   - Previous approved revision of the same drawing (if any) transitions to `superseded`
   - Event logged
   - Notification sent to Designer and Project Manager
   - Drawing status updated to `approved`

### 6.6 Client returns a revision with comments

1. Client clicks "Return with Comments" on a revision in `for_review`
2. System checks at least one comment exists on this revision; if not, prompts "Please add a comment explaining what needs to change"
3. On confirm:
   - Revision state changes to `returned_with_comments`
   - Event logged
   - Notification sent to Designer
   - Drawing status updated to indicate revision needed

### 6.7 Designer responds to returned comments

1. Designer sees notification, opens drawing
2. Reviews comments
3. Uploads new revision (via 6.2 flow)
4. New revision is in state `draft`; previously returned revision automatically transitions from `returned_with_comments` to `superseded` (or stays as historical reference — to confirm in implementation)
5. Designer can issue the new revision for review (via 6.3 flow)

### 6.8 Designer reviews project status

1. Designer navigates to Working Drawings for a project
2. Sees the drawing register: a list of all drawings with their current status
3. Summary at top: "31 drawings expected, 28 active, 22 approved, 5 in review, 1 missing"
4. Can filter by status (approved, in review, draft, missing)
5. Can drill into any drawing to see its full revision history and event log

### 6.9 Anyone views drawing history

1. User opens a drawing
2. Default view: active revision (the latest in `approved` or, if none approved, `for_review`, or, if none, `draft`)
3. "History" expand shows all revisions in order, with state badges
4. Click on any historical revision to view it and its associated comments/events

---

## 7. The Drawing Register

The project-level view that answers: "What drawings exist for this project? What state is each in? What's missing?"

### 7.1 Layout

- Header: project name, summary counts (planned, drafting, for_review, approved, missing)
- View toggle: "By Room" (default) | "By Category"
- **By Room view:** Drawings grouped by room, with project-level drawings (those with `room_id = NULL`) in a top section labelled "Project-Level Drawings"
- **By Category view:** Drawings grouped by category as in the original framework
- Each drawing row shows: drawing number (if any), title, room (if applicable), active revision letter, current status, last activity date
- Status badges: distinct colours for each status
- Filter controls: by status, by category, by room, by discipline
- "New Drawing" button
- "Manage Rooms" link in the header (opens room management modal)

### 7.2 Template-driven population

When a project is created:
- User selects a template ("Residential Interior" or "Office Interior")
- Template's predefined drawings are inserted into the `drawings` table for this project, with `is_template_placeholder = true` and `status = 'planned'`
- These appear in the register but have no revisions yet
- When a user uploads a drawing matching a placeholder's title and category, the placeholder is fulfilled (`is_template_placeholder = false`, status changes to `drafting`)
- Placeholders that remain unfulfilled show as "Missing" in the register

The two initial templates are defined in code (see Section 8).

### 7.3 The "Missing" indicator

A drawing is "missing" if:
- It exists as a template placeholder (`is_template_placeholder = true`)
- No revisions have been uploaded for it

The missing list is a useful daily artefact. Your daughter looks at the register, sees that "Kitchen Elevation East" is missing, and chases the architect for it.

---

## 8. Project Templates

Two templates ship initially. Both are defined in application code, not the database, so changes require a deploy.

Templates have two levels:
- **Project-level drawings:** generated once per project, regardless of room count
- **Room-level drawings:** generated per room of a given type

### 8.1 Residential Interior — Project-Level Drawings

Generated once per project:

- Site Plan / Building Floor Plan (where relevant)
- Floor Plan: Existing Condition
- Floor Plan: Demolition
- Floor Plan: Proposed Layout
- Floor Plan: Furniture Layout
- Floor Plan: Electrical Layout (whole apartment)
- Floor Plan: Plumbing Layout (whole apartment)
- Floor Plan: HVAC Layout (whole apartment)
- Floor Plan: Flooring Pattern
- Reflected Ceiling Plan (whole apartment)
- Finishes Schedule
- Hardware Schedule
- Door & Window Schedule
- Materials Schedule
- BOQ
- Specification

### 8.2 Residential Interior — Room-Level Drawings

Generated per room of the given type:

**For each `bedroom` room:**
- Floor Plan
- Reflected Ceiling Plan
- Wall Elevations (one placeholder per significant wall; designer prunes as needed)
- Joinery Detail: Wardrobe
- Joinery Detail: Bed Wall (headboard, side tables)
- Joinery Detail: Study/Dresser

**For each `bathroom` room:**
- Floor Plan
- Reflected Ceiling Plan
- Wall Elevations (typically 4)
- Joinery Detail: Vanity
- Fixture Schedule

**For each `kitchen` room:**
- Floor Plan
- Reflected Ceiling Plan
- Wall Elevations
- Joinery Detail: Base Cabinets
- Joinery Detail: Wall Cabinets
- Joinery Detail: Tall Units
- Appliance Schedule

**For each `living`, `dining`, or `family_room` room:**
- Floor Plan
- Reflected Ceiling Plan
- Wall Elevations
- Joinery Detail: TV Unit / Media Wall
- Joinery Detail: Display / Bar Unit
- Joinery Detail: Dining Storage

**For each `foyer` room:**
- Floor Plan
- Wall Elevations
- Joinery Detail: Shoe Cabinet / Console

**For each `study` room:**
- Floor Plan
- Reflected Ceiling Plan
- Wall Elevations
- Joinery Detail: Desk / Storage

**For each `utility` room:**
- Floor Plan
- Wall Elevations
- Joinery Detail: Storage

**For `pooja`, `staff`, `balcony`, `other`:**
- Floor Plan
- Wall Elevations (where relevant)

### 8.3 Office Interior

(To be defined in collaboration with daughter before Phase 7. Likely structure: project-level drawings similar to residential plus a per-workstation template, conference rooms, executive cabins, etc.)

### 8.4 Template Application Flow

When a project is created:
1. Designer selects a template
2. System creates project-level drawing placeholders (16 for Residential)
3. Designer adds rooms (count and type) — names are auto-suggested ("Bedroom 1", "Bathroom 1") but editable
4. System creates room-level drawing placeholders for each room based on type
5. Placeholders appear in the register as "Missing"

### 8.5 Template Customisation Post-Creation

After a project is created from a template:
- Designer can rename rooms at any time ("Bedroom 1" → "Riya's Bedroom")
- Designer can add new rooms (creates new placeholders per type)
- Designer can delete a room (if no drawings have been uploaded to it; otherwise must first move or delete drawings)
- Designer can mark a placeholder as "Not Applicable" (hides from missing list)
- Designer can add ad-hoc drawings not in the template
- Designer can edit a placeholder's title before any revisions are uploaded

After revisions are uploaded, the placeholder is converted to a real drawing and edit-ability is reduced (title only, no category change).

---

## 9. Notifications

### 9.1 What triggers a notification

- Revision issued for client review → notify all Client users on the project
- Revision approved → notify Designer (issuer) and Project Manager
- Revision returned with comments → notify Designer
- New comment on a revision → notify all users who have previously commented or who are the uploader/approver
- New drawing created → no notification (would be too noisy)

### 9.2 Notification channels

For initial deployment:
- In-app notification badge (always on)
- Email notification (always on, user can disable per type in settings)

WhatsApp and SMS are not built but the notification module should be structured so adding them later is straightforward (a new handler implementation, not a refactor).

### 9.3 Notification table

A simple `notifications` table:
- `id`, `org_id`, `user_id`, `event_id` (links to `revision_events`)
- `read_at` (timestamp, nullable)
- `created_at`

When a user opens the activity related to a notification, it's marked read.

---

## 10. Migration Path

### 10.1 What exists today

The current `working_drawings` table (or whatever it's called) has 34 rows for Maker Tower with manual "v1.0" labels and "Active" status. These represent your daughter's current project drawings.

### 10.2 Migration strategy

A one-time migration that:

1. Creates the new tables (`drawings`, `drawing_revisions`, `drawing_approvals`, `revision_events`, `drawing_comments`, `notifications`)
2. For each existing row in the old `working_drawings` table:
   - Creates a new `drawings` row with the existing title, inferred category (best-effort match against the category list; "Other" if no match), status `approved`, and a flag indicating this is a pre-system drawing
   - Creates a `drawing_revisions` row as Revision A, state `approved`
   - Creates a `revision_events` row with type `uploaded` and a synthetic `approved` event
   - Does NOT create a `drawing_approvals` row (we don't have legitimate approval data for these)
3. Tags the old `working_drawings` table as deprecated, retains it for safety but app no longer reads from it
4. After validation, the old table can be dropped in a later migration

The migration is part of Phase 1 deployment.

### 10.3 Daughter's current work is not disrupted

After migration:
- All existing 34 drawings appear in the new register, marked as approved (since they were in use)
- A small badge or note indicates "Imported from previous system; no formal approval record"
- Going forward, all new uploads go through the new workflow

---

## 11. Implementation Plan — 10 Prompts

Each prompt is a single Replit session with verification before moving on. No bundling. If a prompt reveals a problem, fix within the same session.

### Prompt 1 — Investigation (no code changes)

Answer the open questions before writing any new code:

- What PDF preview library is available or recommended? Show me what's installed in package.json and what the existing code uses for any PDF rendering.
- Where do uploaded files currently live? Filesystem path, object storage, Replit volume?
- What is the production `working_drawings` table schema? Run a describe query.
- How many rows exist in `working_drawings` in production? Broken down by project.
- Does `working_drawings` have an `org_id` column in production?
- Is there an existing notification mechanism in the app (in-app badges, email)? If so, how does it work?

Output: a written report covering all six. No code changes.

### Prompt 2 — Data model and migration

Build all six new tables in one Drizzle migration. Migrate the 34 existing working drawings into the new model.

Tables: `rooms`, `drawings`, `drawing_revisions`, `drawing_approvals`, `revision_events`, `drawing_comments`. All `org_id`-tagged. Indexes and foreign keys per Section 4.

Migration of existing data:
- For each existing `working_drawings` row, create a `drawings` row with title from existing, category inferred (best match to category list, "Other" if no match), `room_id = NULL` (no rooms yet), `status = 'approved'`, `is_template_placeholder = false`
- Create matching `drawing_revisions` row as Revision A, `state = 'approved'`
- Create matching `revision_events` row with type `uploaded`
- Do NOT create `drawing_approvals` rows (we don't have legitimate approval data)
- Old `working_drawings` table renamed to `working_drawings_legacy`; not dropped

Acceptance: production has 6 new tables. 34 drawings rows for Maker Tower. 34 revisions in state `approved`. Old table still exists as `working_drawings_legacy`.

### Prompt 3 — Rewire existing UI to new tables

The Working Drawings page reads from new tables. Functionally identical to today.

Build:
- API endpoints reading from `drawings` and `drawing_revisions`
- Frontend reads from new endpoints
- Upload still works; new uploads create both a `drawings` row and a `drawing_revisions` row in `state = 'approved'` (temporary backward-compatibility until Prompt 5 introduces the new flow)

Acceptance: visual check — page looks identical to before. All 34 drawings visible. Upload works.

### Prompt 4 — Rooms feature

Build the rooms management UI and link drawings to rooms.

Build:
- Rooms management modal: list rooms for a project, add new (name + type), rename, reorder, delete (only if no drawings reference the room)
- Backfill rooms for Maker Tower manually via the UI (no migration script — your daughter will define the rooms herself)
- Update drawing creation/edit form to include optional Room field
- Update Working Drawings page to display the Room column

Acceptance: Maker Tower has rooms defined. Drawings can be assigned to rooms. Empty room_id remains valid (project-level drawings).

### Prompt 5 — Revision history and lifecycle

Add the revision history view and the four lifecycle states.

Build:
- "Upload New Revision" action on existing drawings (form: file + revision note text)
- Backend assigns next revision letter
- Drawing detail view: shows active revision prominently + "History" expand showing all revisions with state badges
- State machine enforced in backend per Section 5
- States visible as badges (colour-coded)
- New uploads create revisions in `state = 'draft'` (not 'approved') for drawings created post-migration; existing migrated drawings retain their `approved` status

Acceptance: can upload Revision B of an existing drawing with a note. History shows revisions in order. State transitions per spec.

### Prompt 6 — Approval flow

Add Client role, the approval mechanism, and notifications.

Build:
- Role assignment per project (Designer, Architect, Project Manager, Client) — UI for assigning users to projects with a role
- "Issue for Client Review" action (Designer only) on draft revisions
- Client-filtered view: API enforces visibility filter (clients see only `for_review`, `approved`, `superseded`)
- "Approve" and "Return with Comments" actions (Client only)
- `drawing_approvals` records on approval with IP, user-agent, timestamp
- In-app notifications for the key events (issue → notify client; approve → notify designer; return → notify designer)
- Email notifications using whatever mechanism Prompt 1 revealed (or a simple SMTP if none exists)
- "Pending Your Review" widget on client dashboard

Acceptance: end-to-end test with two users (designer + client). Designer issues, client sees, client approves. Approval recorded in `drawing_approvals` with full audit data. Designer notified.

### Prompt 7 — Drawing register and templates

Build the project-level register and template-driven population.

Build:
- Project-level register page with By Room (default) and By Category views
- Summary counts at top
- Missing drawings indicator
- Residential Interior template definitions in code (project-level + room-level per Section 8)
- Template application when creating a new project: ask for rooms, generate placeholders
- For existing Maker Tower: provide a one-time "Apply Template" action that generates placeholders and asks user to map existing drawings to placeholders (or leave them as ad-hoc)

Acceptance: new project from template generates expected placeholders. Maker Tower can be backfilled with template. Missing indicator works.

### Prompt 8 — Comments and activity feed

Build inline comments on revisions and the project activity feed.

Build:
- Comment thread on each revision (text comments, threaded via `parent_comment_id`)
- Comments visible by role (clients see comments they can see drafts of, etc.)
- Project-level activity feed showing recent events across all drawings (uploaded, issued, approved, returned, commented)
- Per-drawing activity log

Acceptance: any role can comment on visible revisions. Comments are threaded. Activity feed shows events with actor names.

### Prompts 9 and 10 — Reserved for fixes

Not planned features. Insurance for the inevitable bug or adjustment after using the system in real work.

If everything goes perfectly, use these for:
- Performance issues (the register page may need pagination if projects have 100+ drawings)
- UI polish (better state badge colours, room reordering, etc.)
- A small Phase 6 addition (per Section 11 in the original phased plan, things like "Notes on rooms" or "Drawing tags")

If anything goes wrong in Prompts 1-8, these are the recovery budget.

---

## 12. Things Explicitly Out of Scope

Important to name what we are NOT building, so it doesn't creep in:

- **Drawing markup tools** (drawing on PDFs, pinning comments to regions). Future work; comments are text-only for now.
- **Multi-step approval workflows** (Internal Review before Client Approval). Data model supports it; UI does not expose it.
- **Custom role creation.** Four roles are fixed.
- **Vendor accounts.** Vendors receive drawings via shareable read-only links (future feature), not as app users.
- **Drawing comparison view** (side-by-side of two revisions). Future feature.
- **AutoCAD file editing.** Files are stored as-is; viewing is read-only via PDF preview where applicable.
- **Integration with external systems** (BIM 360, Newforma, Procore). Future feature.
- **Digital signature integration** (DocuSign, etc.). The medium-formality approval (click + IP + timestamp) is sufficient.
- **Mobile-specific UI.** The web UI should be responsive; native mobile is future work.

---

## 13. Open Questions to Resolve During Phase 1

These don't block design but should be settled in implementation:

1. **PDF preview rendering.** Most drawings are PDFs. Does the existing app have a PDF viewer component, or do we need to add one? If add: which library?
2. **File storage.** Where do uploaded files live now? Replit's filesystem, S3, something else? The new tables reference `file_path` — the path interpretation depends on this.
3. **Drawing number auto-generation.** What's the format? Suggested: `{PROJECT_CODE}-{CATEGORY_CODE}-{SEQUENCE}` where PROJECT_CODE is a short alias entered at project creation. Confirm with daughter.
4. **What "supersede" means for `returned_with_comments`.** When the designer uploads a new revision in response to comments, does the old returned revision become `superseded` or stay as `returned_with_comments` for historical clarity? I lean toward superseded for consistency.

These get answered during Phase 1 implementation, not during design.

---

## 14. Multi-Tenant Considerations

Every table in this spec has `org_id` from creation. Every query against these tables must filter by `org_id`. This is non-negotiable and is the reason the schema looks heavier than a single-tenant version would.

The pattern established in earlier work in this project (the multi-tenant `org_id` migration 0004 and the per-tenant filtering middleware) applies here. New tables are Group A (per-tenant), not Group B (shared with override).

When tenant #2 onboards in the future, drawings, revisions, approvals, comments, and events are all naturally isolated by `org_id`. The Working Drawings system inherits the multi-tenant safety properties of the rest of the application.

---

## 15. Success Criteria (Overall)

After all phases ship, your daughter should be able to:

1. Open Working Drawings for a project and immediately see what's done, in review, missing
2. Upload a new drawing or a revision to an existing one in under 30 seconds
3. Issue a drawing to a client with one click
4. See a clear record of which clients approved which revisions and when
5. Trust that if she opens a drawing, the latest approved version is what's shown by default
6. Audit the full history of any drawing if a dispute arises

A junior designer joining her team should be able to use the system without training because:
- The UI is uncluttered
- The state names mean what they say
- The "missing drawings" list tells them what to work on
- They can't accidentally bypass approval (system enforces the state machine)

And in three years, when a senior designer wants to review junior work before it goes to the client, the data model already supports it. Only UI work is needed to enable that workflow.

---

## 16. What Happens Next

This spec is the source of truth. Each phase becomes a Replit prompt. The prompts should reference this document and the specific phase's acceptance criteria.

Before Phase 1, two things need clarification:
- Confirm the open questions in Section 13 with implementation findings
- Get daughter's input on the Residential Interior template list in Section 8.1 (anything missing? anything that shouldn't be there?)

Then build, verify, commit, repeat. The pattern from the SOPs work: every Replit prompt has a runtime self-test; performance is checked when wrapping routes; user-visible changes are reviewed in the running app before considered done.
