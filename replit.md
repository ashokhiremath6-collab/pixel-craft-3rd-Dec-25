# PixelCraft Designer

## Overview

A comprehensive vendor management system designed for tracking projects, quotations, and vendor relationships across different categories like Civil, Electrical, and Lighting. The system enables users to manage vendor information, compare quotes, track project progress, and maintain a centralized database of construction-related vendors with their quotations and project associations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom design system following Material Design principles
- **State Management**: TanStack Query for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful endpoints following conventional HTTP methods

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with schema-first approach
- **Connection Pooling**: Neon serverless connection pooling
- **Migrations**: Automatic migration system for production deployments
  - Development: `npm run db:push` for direct schema sync
  - Production: Migrations auto-applied on server startup via `server/migrate.ts`
  - Graceful handling when DATABASE_URL not set (dev environments)
  - Full support for Drizzle Kit's timestamped migration directories
  - Non-blocking migration runner prevents server crashes
  - See MIGRATIONS.md for complete workflow documentation
- **File Storage**: Replit Object Storage (Google Cloud Storage) for permanent file persistence
  - All uploaded files (floor plans, moodboards, renders, quotations, BOQ files) stored in object storage
  - Files persist across deployments and workflow restarts
  - ACL-based access control for file security
  - Paths stored in database as `/objects/uploads/<uuid>`

### Core Data Models
- **Vendor Categories**: Hierarchical structure with parent-child relationships
- **Vendors**: Linked to categories with contact information
- **Projects**: Client projects with date ranges and vendor associations
- **Project-Vendor Relations**: Junction table for many-to-many relationships with quotation data
- **Quote Templates**: Reusable templates for different vendor categories
- **BOQ & Quote Files**: File management for quotation documents
- **Project Schedules**: Gantt chart schedules with 250-task capacity
- **Tasks**: Individual project tasks with dependencies, dates, and progress tracking
- **Task Dependencies**: Support for all 4 dependency types (FS, SS, FF, SF) with lag

### Design System
- **Component Library**: Custom components built on Radix UI primitives
- **Color Palette**: Professional blue primary (216 100% 25%) with neutral surfaces
- **Typography**: Inter for UI text, JetBrains Mono for data tables
- **Layout**: 12-column responsive grid with consistent spacing units
- **Theming**: Light/dark mode support with CSS custom properties

### User Interface Structure
- **Sidebar Navigation**: Collapsible sidebar with main navigation items
- **Dashboard**: Overview with vendor statistics and recent quotations
- **Vendor Management**: Category-based vendor listing with CRUD operations
- **Project Management**: Project creation and vendor association
- **Project Scheduling**: Advanced Gantt chart with Critical Path Method (CPM) analysis
- **Comparative Quotes**: Cross-project quotation analysis and comparison
- **Templates**: Quote template management for different categories

### Advanced Project Scheduling
- **Gantt Chart Template**: 250-row Excel template with Instructions sheet
  - 18 columns: ID, Name, Start, Finish, Duration, % Complete, Predecessors, Resource Names, Status, Priority, Approval Required, Materials, Owner, Target Start/Finish, Remarks, Outline Level, Color
  - Includes 3 sample tasks with dependency examples
  - Built-in Instructions sheet with column descriptions, format examples, and dependency syntax guide
- **Critical Path Analysis**: Full CPM algorithm implementation
  - Forward pass: Calculates Early Start (ES) and Early Finish (EF) for all tasks
  - Backward pass: Calculates Late Start (LS) and Late Finish (LF) for all tasks
  - Total Float calculation: Identifies slack time available for each task
  - Critical path identification: Highlights tasks with zero float (must complete on time)
  - Project duration calculation: Shows total project timeline
  - Cycle detection: Prevents circular dependencies
- **Dependency Types**: All 4 standard precedence relationships
  - FS (Finish-to-Start): Task must finish before successor starts
  - SS (Start-to-Start): Task must start before successor starts
  - FF (Finish-to-Finish): Task must finish before successor finishes
  - SF (Start-to-Finish): Task must start before successor finishes
  - Lag support: Positive/negative time offsets (e.g., `2(FS)+3` or `3(FF)-1`)
- **Visual Display**: Compact summary banner showing project metrics, numbered critical tasks, hover effects

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Environment**: DATABASE_URL for connection string configuration

### UI Component Libraries
- **Radix UI**: Accessible component primitives for complex UI elements
- **Lucide React**: Icon library for consistent iconography
- **TailwindCSS**: Utility-first CSS framework for styling

### Development Tools
- **TypeScript**: Static type checking across frontend and backend
- **ESBuild**: Fast JavaScript bundler for production builds
- **Vite**: Development server with hot module replacement
- **Drizzle Kit**: Database schema management and migration tools

### Third-Party Integrations
- **Google Fonts**: Inter and JetBrains Mono font families
- **Replit Integration**: Development environment integration with runtime error overlay
- **Replit Object Storage**: Permanent cloud file storage via Google Cloud Storage backend

### Runtime Dependencies
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation for API endpoints and forms
- **Date-fns**: Date manipulation and formatting utilities
- **Class Variance Authority**: Type-safe component variant management