# PixelCraft Designer

## Overview

PixelCraft Designer is a comprehensive vendor management system focused on tracking projects, quotations, and vendor relationships across various construction categories (Civil, Electrical, Lighting). It centralizes vendor information, facilitates quote comparison, tracks project progress, and manages a database of construction-related vendors, their quotations, and project associations. The system also integrates advanced AI capabilities for design intelligence, render generation, and asset management to streamline interior design workflows.

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
- **Design Intelligence Chat**: AI assistant powered by Gemini 2.5 Flash for design-related queries, accessible by Admin and Designer roles. Provides expert advice on dimensions, ergonomics, and space planning.
- **AI Render Generation**: Uses Gemini 2.5 Flash Image model to generate renders with style presets, catalogue item integration, reference photo support, and a grid overlay system. Includes smart modification tools for editing existing renders.
- **Asset Ingestion System**: Two-mode workflow (Analyze-Only, AI-Edit) for processing images, generating descriptions, and providing prompt hints. Supports AI-based image editing (e.g., background removal).
- **Saved Assets System**: Central repository for processed images, reusable across AI renders, with search, tags, and source type tracking. Integrates with Asset Ingestion and AI Renders via an asset picker component.

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