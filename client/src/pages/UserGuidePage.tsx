import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home, Building2, Users, BarChart3, DollarSign, Upload, FileText,
  GanttChart, ImageIcon, Sparkles, PenTool, Lightbulb, BrainCircuit,
  Wand2, Camera, BookOpen, Calendar, FileSignature, Wallet, Receipt,
  PackageCheck, MessageSquare, Settings, ChevronRight, Info, Zap,
  ClipboardList, Shield, UserCheck, Eye, Lock
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: typeof Home;
  badge?: string;
  content: React.ReactNode;
}

function SectionContent({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 text-sm leading-relaxed">{children}</div>;
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground mt-6 mb-2 first:mt-0">{children}</h3>;
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 list-none">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
          <span className="text-muted-foreground">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 p-3">
      <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-blue-800 dark:text-blue-300 text-sm">{children}</p>
    </div>
  );
}

function FeatureGrid({ items }: { items: { icon: typeof Home; label: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex gap-3 rounded-md border border-border bg-muted/30 p-3">
          <item.icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleTable() {
  const roles = [
    { role: "Admin", access: "Full access to everything — settings, billing, all projects, all users.", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    { role: "Designer", access: "Full project & AI access. Cannot manage org settings or billing.", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    { role: "Project Manager", access: "Scheduling, working drawings, works orders, meeting minutes, SOPs.", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { role: "Client", access: "Read-only client portal — their project's timeline, renders, drawings, specs.", badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    { role: "Vendor", access: "Vendor portal — view RFQs, submit quotes, manage their documents.", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  ];
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="grid grid-cols-3 gap-0 bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
        <span>Role</span>
        <span className="col-span-2">What they can do</span>
      </div>
      {roles.map((r, i) => (
        <div key={r.role} className={`grid grid-cols-3 gap-0 px-3 py-2.5 text-sm ${i !== roles.length - 1 ? "border-b border-border" : ""}`}>
          <span>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.badge}`}>{r.role}</span>
          </span>
          <span className="col-span-2 text-muted-foreground">{r.access}</span>
        </div>
      ))}
    </div>
  );
}

const sections: Section[] = [
  {
    id: "overview",
    title: "Overview",
    icon: Home,
    content: (
      <SectionContent>
        <Para>
          Pixelcraft Designs is an all-in-one studio management platform for interior design studios. It brings your projects, vendors, AI tools, client communication, and team workflow into one place — replacing scattered spreadsheets, email threads, and shared drives.
        </Para>
        <Heading>What you can do</Heading>
        <FeatureGrid items={[
          { icon: Building2, label: "Manage projects", desc: "Track every client project from brief to handover." },
          { icon: Users, label: "Manage vendors", desc: "Centralise vendor contacts, quotes, and payments." },
          { icon: BrainCircuit, label: "AI Design Intelligence", desc: "Get instant design advice, floor plans, and elevations." },
          { icon: Wand2, label: "AI Render Generation", desc: "Generate photorealistic renders in seconds." },
          { icon: GanttChart, label: "Project scheduling", desc: "Gantt chart with critical path analysis." },
          { icon: Eye, label: "Client portal", desc: "Give clients a clean, read-only view of their project." },
        ]} />
        <Heading>Navigation</Heading>
        <Para>Use the sidebar on the left to move between sections. Click the toggle at the top to collapse it and gain more screen space. Each section is described in detail below.</Para>
        <TipBox>Your role determines which sections are visible. Admins and Designers see everything. Project Managers see scheduling-related sections. Clients and Vendors have their own dedicated portals.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "roles",
    title: "Roles & Access",
    icon: Shield,
    content: (
      <SectionContent>
        <Para>Every user in the platform has a role that controls what they can see and do. Roles are assigned when you invite someone via Settings → Client Access (for clients) or Settings → Team (for staff).</Para>
        <Heading>Role overview</Heading>
        <RoleTable />
        <Heading>Inviting users</Heading>
        <StepList steps={[
          "Go to Settings in the sidebar.",
          "For studio staff (Designers, Project Managers): use the Team Members section to invite by email and select a role.",
          "For clients: go to Client Access, pick the project, and send an invitation link.",
          "For vendors: vendors receive an invitation via email when you send them an RFQ or payment request.",
        ]} />
        <TipBox>Clients only see data for the project they're linked to. They cannot see other projects, vendors, or any internal notes.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "projects",
    title: "Projects",
    icon: Building2,
    content: (
      <SectionContent>
        <Para>Projects are the core of the platform. Every piece of work — drawings, vendors, schedules, renders — is organised under a project.</Para>
        <Heading>Creating a project</Heading>
        <StepList steps={[
          'Go to "Projects" in the sidebar.',
          'Click "Add Project" and fill in the project name, client name, and budget.',
          "The project will appear in your dashboard and is immediately accessible to your team.",
        ]} />
        <Heading>Project sections</Heading>
        <FeatureGrid items={[
          { icon: GanttChart, label: "Scheduling", desc: "Gantt chart for this project's timeline and tasks." },
          { icon: BarChart3, label: "Comparative quotes", desc: "Compare vendor quotes side-by-side." },
          { icon: PenTool, label: "Working drawings", desc: "Upload and categorise all drawings." },
          { icon: ImageIcon, label: "Moodboards", desc: "Visual reference boards for the design direction." },
          { icon: MessageSquare, label: "Chat", desc: "Team messaging with PDF and file attachments." },
          { icon: Receipt, label: "Project cost", desc: "Cost breakdown and budget tracking." },
        ]} />
        <Heading>Restricting a project</Heading>
        <Para>You can mark a project as restricted so that only explicitly assigned team members can view it. Useful for sensitive or confidential client work.</Para>
      </SectionContent>
    ),
  },
  {
    id: "chat",
    title: "Chat",
    icon: MessageSquare,
    badge: "New",
    content: (
      <SectionContent>
        <Para>Each project has a dedicated chat thread where your team can communicate and share files. PDFs and images are rendered inline — no need to download them to view.</Para>
        <Heading>How to use chat</Heading>
        <StepList steps={[
          'Go to "Chat" in the sidebar.',
          "Select the project from the dropdown at the top.",
          "Type your message and press Enter or click Send.",
          "To attach a file, click the paperclip icon. PDFs will display directly inside the chat.",
        ]} />
        <TipBox>Click on any PDF attachment to open it in a full-screen viewer — it renders inline without leaving the app or opening a new tab.</TipBox>
        <Heading>Unread messages</Heading>
        <Para>The Chat item in the sidebar shows a badge with the count of unread messages. It refreshes every minute automatically.</Para>
      </SectionContent>
    ),
  },
  {
    id: "vendors",
    title: "Vendors & Quotes",
    icon: Users,
    content: (
      <SectionContent>
        <Para>The vendor management system covers the entire procurement workflow — from your vendor database to comparing quotes and generating works orders.</Para>
        <Heading>Vendors by Category</Heading>
        <Para>Your studio's master vendor list, organised by trade category (e.g. Flooring, Lighting, Furniture). Add vendors once and reuse them across all projects.</Para>
        <StepList steps={[
          'Open "Vendors by Category" in the sidebar.',
          'Click "Add Vendor" to create a new vendor with contact details and category.',
          "Vendors are shared across all projects in your org.",
        ]} />
        <Heading>Comparative Quotes</Heading>
        <Para>Link vendors to a project and record their quoted amounts. The comparative view displays all vendors side-by-side so you can make the best selection quickly.</Para>
        <Heading>Unit Rate Quotes</Heading>
        <Para>For work priced per unit (per sq ft, per running metre, etc.). Enter quantities and rates — totals are calculated automatically.</Para>
        <Heading>Import Quotes</Heading>
        <Para>Paste or upload a quote from a vendor and let the platform parse it into structured line items. Saves manual entry time.</Para>
        <Heading>Works Orders</Heading>
        <Para>Once a vendor is selected, generate a formal works order from the quote. Works orders can be sent to vendors via email and tracked by status.</Para>
        <TipBox>Vendors receive an email with a link to view their works order or payment request — they don't need a full account to respond.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "scheduling",
    title: "Scheduling",
    icon: GanttChart,
    content: (
      <SectionContent>
        <Para>The Gantt chart gives you a visual timeline of every task in a project, with support for dependencies, critical path analysis, and up to 250 tasks per project.</Para>
        <Heading>Creating tasks</Heading>
        <StepList steps={[
          'Open "Project scheduling" in the sidebar.',
          "Select the project from the dropdown.",
          'Click "Add Task", enter a name, start date, and duration.',
          "Drag the task bar to reschedule, or resize it to change duration.",
        ]} />
        <Heading>Dependencies</Heading>
        <Para>Link tasks so they can't start before a predecessor finishes. The platform supports all four dependency types: Finish-to-Start, Start-to-Start, Finish-to-Finish, and Start-to-Finish — with optional lag days.</Para>
        <Heading>Critical Path</Heading>
        <Para>The critical path is automatically calculated and highlighted. Tasks on the critical path are the ones that would delay the overall project if they slip.</Para>
        <TipBox>You can reorder tasks by dragging them in the task list on the left side of the Gantt.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "drawings",
    title: "Drawings & Moodboards",
    icon: PenTool,
    content: (
      <SectionContent>
        <Para>Pixelcraft organises your visual deliverables into distinct sections so nothing gets mixed up.</Para>
        <Heading>Concept Drawings</Heading>
        <Para>Early-stage sketches, mood references, and concept visuals. Organised by category and versioned so you can track design evolution.</Para>
        <Heading>Working Drawings</Heading>
        <Para>Construction-ready technical drawings — floor plans, elevations, sections, details. Upload PDFs or images against a category (e.g. Electrical, Plumbing, Furniture layout). Clients can see these in their portal.</Para>
        <Heading>Moodboards</Heading>
        <Para>Visual reference boards combining images, materials, and colour palettes. Create multiple moodboards per project and share them with clients via the client portal.</Para>
        <Heading>Renders</Heading>
        <Para>Photorealistic 3D renders uploaded or generated via AI Renders. Organised per project and visible to clients.</Para>
        <TipBox>Working drawings, renders, and moodboards are all visible to clients in the Client Portal — other internal sections are not.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "ai-intelligence",
    title: "Design Intelligence",
    icon: BrainCircuit,
    badge: "AI",
    content: (
      <SectionContent>
        <Para>Design Intelligence is an AI chat assistant (powered by Claude Sonnet) trained for interior design. It answers technical and creative questions, generates drawings, and analyses your files.</Para>
        <Heading>What you can ask</Heading>
        <FeatureGrid items={[
          { icon: BrainCircuit, label: "Design advice", desc: "Materials, spatial planning, furniture layout, colour theory." },
          { icon: Zap, label: "Floor plans", desc: "Generates an SVG + DXF floor plan at 1:50 scale." },
          { icon: Zap, label: "Elevation drawings", desc: "Generates wall elevation drawings as SVG + DXF." },
          { icon: ClipboardList, label: "Render brief", desc: "Converts your conversation into an AI render prompt." },
          { icon: FileText, label: "File analysis", desc: "Upload SketchUp .dxf/.obj files for AI geometry analysis." },
          { icon: ImageIcon, label: "Image analysis", desc: "Upload a photo and get design feedback or suggestions." },
        ]} />
        <Heading>DXF files</Heading>
        <Para>DXF files generated by Design Intelligence are importable into SketchUp and AutoCAD at real-world 1:1 mm scale. Named layers (Walls, Furniture, Dimensions, etc.) are included.</Para>
        <Heading>Generate Render Brief</Heading>
        <Para>At the end of a design discussion, click "Generate Render Brief" — the conversation context is transferred to the AI Renders page as a pre-filled prompt, ready to generate.</Para>
        <TipBox>Available to Admin and Designer roles only.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "ai-renders",
    title: "AI Renders",
    icon: Wand2,
    badge: "AI",
    content: (
      <SectionContent>
        <Para>Generate photorealistic interior renders using Gemini 2.5 Flash. Describe the space, select a style, and the AI produces a high-quality image in seconds.</Para>
        <Heading>Creating a render</Heading>
        <StepList steps={[
          'Open "AI Renders" in the sidebar.',
          "Write a description of the space, style, and mood.",
          "Choose a style preset (e.g. Modern, Japandi, Maximalist).",
          "Optionally add reference photos or pick items from your Catalogue.",
          'Click "Generate" and wait 10–30 seconds.',
        ]} />
        <Heading>Style presets</Heading>
        <Para>Presets control the overall visual direction — lighting, colour palette, furniture style. You can combine a preset with your own description for fine-grained control.</Para>
        <Heading>Modifying renders</Heading>
        <Para>Once generated, use the smart modification tools to make targeted edits — change a material, swap furniture, adjust lighting — without regenerating the whole image.</Para>
        <Heading>Grid overlay</Heading>
        <Para>Toggle a grid overlay on the render to check spatial proportions against real dimensions.</Para>
        <TipBox>Renders are saved automatically and can be added to a project's Renders section for client viewing.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "asset-ingestion",
    title: "Asset Ingestion",
    icon: Camera,
    badge: "AI",
    content: (
      <SectionContent>
        <Para>Asset Ingestion processes raw images into reusable, searchable assets that can be used across AI Renders and Moodboards.</Para>
        <Heading>Two modes</Heading>
        <FeatureGrid items={[
          { icon: Eye, label: "Analyse Only", desc: "AI reads the image and generates a description and tags automatically." },
          { icon: Wand2, label: "AI Edit", desc: "AI edits the image — e.g. removes background, changes colour, isolates a product." },
        ]} />
        <Heading>Saved Assets library</Heading>
        <Para>All processed assets land in the Saved Assets library with their AI-generated description and tags. You can search by keyword, filter by source type, and insert them directly into AI render prompts or moodboards.</Para>
        <StepList steps={[
          'Open "Asset Ingestion" in the sidebar.',
          'Click "Upload Image" and select your file.',
          "Choose Analyse Only or AI Edit mode.",
          'Click "Process" — the asset is saved to your library automatically.',
        ]} />
      </SectionContent>
    ),
  },
  {
    id: "catalogue",
    title: "Catalogue",
    icon: BookOpen,
    content: (
      <SectionContent>
        <Para>The Catalogue is your studio's product reference library. Log products by category (acoustics, flooring, lighting, kitchens, etc.) with vendor, brand, description, and supporting files.</Para>
        <Heading>Adding a catalogue item</Heading>
        <StepList steps={[
          'Open "Catalogues" in the sidebar.',
          'Click "Add Item".',
          "Select the Main Category and Subcategory.",
          "Enter the Vendor/Brand, description, key attributes (e.g. NRC rating, material), and attach a brochure PDF.",
          'Click "Save".',
        ]} />
        <Heading>Filtering</Heading>
        <Para>Use the Main Category and Subcategory dropdowns to filter the list. Switch between Grid View and Library View depending on how you prefer to browse.</Para>
        <Heading>Using catalogue in AI Renders</Heading>
        <Para>When generating a render, you can pick items from the catalogue and the AI will incorporate them into the render description automatically.</Para>
        <TipBox>Catalogue items are shared across all projects in your organisation — add a product once and reference it anywhere.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "specifications",
    title: "Specifications",
    icon: FileText,
    content: (
      <SectionContent>
        <Para>Specifications store technical requirement documents per category — materials, finishes, fixtures, equipment — for each project.</Para>
        <Heading>Adding specifications</Heading>
        <StepList steps={[
          'Open "Specifications" in the sidebar.',
          "Select the project.",
          'Click "Add Specification", choose a category, and upload or type the specification content.',
          "Clients can view specifications in their portal.",
        ]} />
        <Para>Specifications are version-aware — you can upload updated documents and the system keeps the history.</Para>
      </SectionContent>
    ),
  },
  {
    id: "sops",
    title: "SOPs",
    icon: ClipboardList,
    content: (
      <SectionContent>
        <Para>SOPs (Standard Operating Procedures) is the studio's internal knowledge base — how you do things, the standards you maintain, and the processes your team must follow.</Para>
        <Heading>Who can do what</Heading>
        <FeatureGrid items={[
          { icon: Eye, label: "View", desc: "All authenticated users can read SOPs." },
          { icon: FileText, label: "Create / Edit", desc: "Admin, Designer, and Project Manager roles." },
          { icon: Lock, label: "Delete", desc: "Admin only." },
        ]} />
        <Heading>Adding an SOP</Heading>
        <StepList steps={[
          'Open "SOPs" in the sidebar.',
          'Click "New SOP".',
          "Give it a title, select a category, and write the content using the rich text editor.",
          "Optionally attach a reference file (e.g. a checklist PDF).",
          'Click "Save".',
        ]} />
        <TipBox>Use SOPs for onboarding new designers — your studio's processes are all in one searchable place.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "meeting-minutes",
    title: "Meeting Minutes",
    icon: Calendar,
    content: (
      <SectionContent>
        <Para>Log structured meeting records per project — attendees, agenda, decisions, and action items — so nothing is lost after a client or team meeting.</Para>
        <Heading>Creating meeting minutes</Heading>
        <StepList steps={[
          'Open "Meeting Minutes" in the sidebar.',
          "Select the project.",
          'Click "Add Minutes".',
          "Enter the meeting date, attendees, and record the discussion points and action items.",
          'Click "Save".',
        ]} />
        <Para>Clients can view meeting minutes for their project in the Client Portal, keeping them informed without any back-and-forth on email.</Para>
      </SectionContent>
    ),
  },
  {
    id: "client-portal",
    title: "Client Portal",
    icon: UserCheck,
    content: (
      <SectionContent>
        <Para>Clients get a dedicated, read-only portal with a clean interface — completely separate from the internal studio view. They log in with their email and only see their project.</Para>
        <Heading>What clients see</Heading>
        <FeatureGrid items={[
          { icon: Home, label: "Overview", desc: "Project stats and overall progress percentage." },
          { icon: GanttChart, label: "Timeline", desc: "A read-only view of the project schedule." },
          { icon: Sparkles, label: "Renders", desc: "All AI and uploaded renders for their project." },
          { icon: ImageIcon, label: "Moodboards", desc: "Design direction boards." },
          { icon: PenTool, label: "Working Drawings", desc: "Technical drawings uploaded by the designer." },
          { icon: FileText, label: "Specifications", desc: "Material and finish specifications." },
          { icon: Calendar, label: "Meeting Minutes", desc: "Records of all meetings." },
        ]} />
        <Heading>Inviting a client</Heading>
        <StepList steps={[
          "Go to Settings → Client Access.",
          "Select the project and enter the client's email address.",
          "Click Send Invitation — the client receives an email with a login link.",
          "Once they set a password, they can log in and see their portal immediately.",
        ]} />
        <TipBox>Clients cannot see vendor costs, internal chat, comparative quotes, or any other project's data.</TipBox>
      </SectionContent>
    ),
  },
  {
    id: "accounts",
    title: "Accounts & Finance",
    icon: Wallet,
    content: (
      <SectionContent>
        <Para>The Accounts section tracks financial records across your projects — vendor invoices, payment requests, and a running ledger.</Para>
        <Heading>Payment Requests</Heading>
        <Para>Generate a formal payment request linked to a works order and send it to your vendor. The vendor receives a link to acknowledge and track the payment status without needing an account.</Para>
        <Heading>Project Cost</Heading>
        <Para>A real-time cost summary per project — showing all vendor quotes, works orders, and payments — so you can track budget vs. actual spend at a glance.</Para>
        <Heading>Accounts ledger</Heading>
        <Para>A complete transaction history of all vendor payments across all projects. Filter by vendor, project, or date range.</Para>
      </SectionContent>
    ),
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    content: (
      <SectionContent>
        <Para>Settings lets you configure your studio's profile, manage team members, and customise the platform for your workflow. Only Admin and Designer roles can access Settings.</Para>
        <Heading>Organisation profile</Heading>
        <Para>Set your studio name, upload a logo, and configure your contact details. These appear on works orders and payment requests sent to vendors.</Para>
        <Heading>Team members</Heading>
        <Para>Invite, manage, and remove team members. Assign roles (Designer, Project Manager) to control what each person can access.</Para>
        <Heading>Quote Templates</Heading>
        <Para>Create reusable templates for vendor quote categories — so you don't start from scratch every time you quote a similar scope of work.</Para>
        <Heading>Notification email</Heading>
        <Para>Set the email address where system notifications (vendor responses, payment acknowledgements) are delivered.</Para>
        <TipBox>If you need to reset a team member's access or change their role, go to Settings → Team and edit from there.</TipBox>
      </SectionContent>
    ),
  },
];

export default function UserGuidePage() {
  const [activeId, setActiveId] = useState("overview");
  const activeSection = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <aside className="w-56 flex-shrink-0 border-r border-border bg-muted/20 flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground">User Guide</h1>
          <p className="text-xs text-muted-foreground mt-0.5">How to use Pixelcraft Designs</p>
        </div>
        <ScrollArea className="flex-1">
          <nav className="py-2 px-2">
            {sections.map((section) => {
              const isActive = section.id === activeId;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveId(section.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors mb-0.5
                    ${isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover-elevate"
                    }`}
                >
                  <section.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{section.title}</span>
                  {section.badge && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 no-default-active-elevate">
                      {section.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Right content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <activeSection.icon className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{activeSection.title}</h2>
          {activeSection.badge && (
            <Badge variant="secondary" className="text-xs no-default-active-elevate">{activeSection.badge}</Badge>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="px-6 py-6 max-w-2xl">
            {activeSection.content}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
