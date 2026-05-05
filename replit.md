# Olympik Design

## Overview

Olympik Design is a public SaaS platform for interior design studios. It provides comprehensive studio management — project tracking, vendor quotes, AI design intelligence, render generation, client portals, Gantt scheduling, catalogues, SOPs, and meeting minutes — all under one roof. It is sold under the brand name "Olympik Design" at olymikdesign.com and targets interior designers as its primary customer. The platform supports multi-tenant organisations with role-based access control (Admin, Designer, Project Manager, Client).

**Public landing page**: Unauthenticated visitors at `/` see the public marketing page (LandingPage.tsx). `/login` shows the login form. `/signup` shows registration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **UI Components**: Radix UI with shadcn/ui
- **Styling**: Tailwind CSS, Material Design principles
- **State Management**: TanStack Query
- **Form Handling**: React Hook Form with Zod validation
- **Theming**: Light/dark mode support with CSS custom properties

### Backend
- **Runtime**: Node.js with Express.js REST API
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM
- **Schema Management**: Drizzle Kit for migrations
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful endpoints
- **Authentication**: Custom email/password auth via passport-local + bcrypt. Endpoints: POST /api/auth/login, /api/auth/logout, /api/auth/register, /api/auth/forgot-password, /api/auth/reset-password, GET /api/auth/verify-email/:token. Implemented in server/localAuth.ts. Email sending via nodemailer (server/email.ts) — configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM env vars; without SMTP, reset tokens are logged to console.
- **Role-Based Access Control (RBAC)**: Admin, Designer, Client roles with tiered permissions for uploads and access.
- **Data Storage**: Replit Object Storage (Google Cloud Storage) for permanent file persistence. Smart download strategy optimizes large file handling.

### Core Features
- **Vendor Management**: Global vendor entities linked to categories with contact information.
- **Project Management**: Client projects with vendor associations.
- **Project-Vendor Relations**: Junction table managing quotations, including "quote" and "comparative" subtypes with conflict detection.
- **Quote Templates**: Reusable templates for vendor categories.
- **BOQ & Quote Files**: File management for quotation documents.
- **Project Scheduling**: Gantt chart with 250-task capacity, Critical Path Method (CPM) analysis, and all 4 dependency types with lag support.
- **Catalogue System**: Interior design product taxonomy with vendor/brand tracking, description, attributes, and file attachments.
- **Specifications System**: Category-wise specification document management with file upload support.
- **Activity Log**: Tracks vendor operations and file uploads with user attribution.
- **Design Intelligence Chat**: AI assistant powered by Claude Sonnet (claude-sonnet-4-6) via Replit Anthropic integration for full-spectrum interior design queries. Supports multimodal input (images, PDFs, DXF, OBJ). Accessible by Admin and Designer roles. Features: Generate Render Brief (transfers conversation to AI Renders page), Floor Plan generator (SVG + DXF output, 1:50 scale), Elevation drawings (SVG + DXF output, 1:50 scale). DXF files are importable into SketchUp and AutoCAD at real-world 1:1 mm scale with named layers (Walls, InternalWalls, Doors, Windows, Furniture, Dimensions, Labels, Title). SketchUp Import: users can attach .dxf or .obj files exported from SketchUp; the AI decodes and analyses the geometry (rooms, walls, openings, dimensions, layers) and provides design feedback.
- **AI Render Generation**: Uses Gemini 2.5 Flash Image model to generate renders with style presets, catalogue item integration, reference photo support, and a grid overlay system. Includes smart modification tools for editing existing renders.
- **Asset Ingestion System**: Two-mode workflow (Analyze-Only, AI-Edit) for processing images, generating descriptions, and providing prompt hints. Supports AI-based image editing (e.g., background removal).
- **Saved Assets System**: Central repository for processed images, reusable across AI renders, with search, tags, and source type tracking. Integrates with Asset Ingestion and AI Renders via an asset picker component.
- **SOPs System**: Standard Operating Procedures repository with category-based organisation, rich text content, optional file attachments, two-panel list/detail layout. View: all authenticated users. Create/Edit: Admin, Designer, Project Manager. Delete: Admin only.
- **Client Portal**: Dedicated read-only portal for clients (role === 'client'). Replaces the standard admin sidebar with a clean top-nav + horizontal tab interface. Tabs: Overview (project stats + progress), Timeline (task schedule), Renders, Moodboards, Working Drawings, Specifications, Meeting Minutes. Data is access-controlled — clients only see their own project(s). Backend: GET /api/client-portal/projects, GET /api/client-portal/:projectId/summary. Frontend: client/src/pages/ClientPortalApp.tsx. Routing: App.tsx detects client role and renders ClientPortalApp instead of AuthenticatedApp.

### User Interface
- **Navigation**: Collapsible sidebar.
- **Dashboards**: Overview with statistics.
- **Management Pages**: Dedicated sections for Vendor, Project, Scheduling, Comparative Quotes, Templates, Catalogue, and Specifications.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting.

### UI Component Libraries
- **Radix UI**: Accessible component primitives.
- **Lucide React**: Icon library.
- **TailwindCSS**: Utility-first CSS framework.

### Development Tools
- **TypeScript**: Static type checking.
- **Vite**: Development server and bundler.
- **Drizzle Kit**: Database schema management.

### Third-Party Integrations
- **Google Fonts**: Inter and JetBrains Mono.
- **Replit Integration**: Development environment.
- **Replit Object Storage**: Permanent cloud file storage (Google Cloud Storage backend).
- **Google Gemini 2.5 Flash**: AI integration for design intelligence and render generation.

### Runtime Dependencies
- **TanStack Query**: Server state management.
- **React Hook Form**: Form state management.
- **Zod**: Runtime type validation.
- **Date-fns**: Date manipulation.