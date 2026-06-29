import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import QuotationRow from "./QuotationRow";
import { Search, Plus, Building2, Edit, Trash2, Users, FileText, X, CheckCircle2 } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/currencyUtils";
import type { Project } from "@shared/schema";

interface ProjectData extends Project {
  vendorCount: number;
}

interface QuotationData {
  id: string;
  vendorName: string;
  category: string;
  quotationValue: string;
  dateOfQuotation: string;
  status: "Quoted" | "Selected" | "Rejected";
  quotationFile?: string;
  notes?: string;
  isAboveAverage?: boolean;
}

interface ProjectViewProps {
  projects: ProjectData[];
  quotations: Record<string, QuotationData[]>;
  onAddProject?: () => void;
  onEditProject?: (project: Project) => void;
  onViewProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  isDesigner?: boolean;
}

const GRADIENT_PALETTES = [
  "linear-gradient(135deg, #c9a96e 0%, #8b6914 50%, #5c4209 100%)",
  "linear-gradient(135deg, #a8c5da 0%, #5b8fa8 50%, #2d5f7a 100%)",
  "linear-gradient(135deg, #b5c9b0 0%, #6e9b68 50%, #3d6b38 100%)",
  "linear-gradient(135deg, #d4b0a5 0%, #a67060 50%, #7a4535 100%)",
  "linear-gradient(135deg, #9bafc8 0%, #5272a0 50%, #2a4878 100%)",
  "linear-gradient(135deg, #c5b8d0 0%, #8b72a8 50%, #5a3f80 100%)",
];

function getProjectGradient(index: number) {
  return GRADIENT_PALETTES[index % GRADIENT_PALETTES.length];
}

function getProjectInitials(name: string) {
  return name
    .split(" ")
    .filter(w => w.length > 0)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
}

function calcProgress(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

function formatDateShort(dateString: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isProjectActive(project: Project) {
  if (!project.endDate) return true;
  return new Date(project.endDate) > new Date();
}

export default function ProjectView({
  projects,
  quotations,
  onAddProject,
  onEditProject,
  onDeleteProject,
  isDesigner = false,
}: ProjectViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const filteredProjects = projects.filter(
    (p) =>
      p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProjectData = selectedProject
    ? projects.find((p) => p.id === selectedProject)
    : null;
  const selectedProjectQuotations = selectedProject
    ? quotations[selectedProject] || []
    : [];

  return (
    <div
      className="min-h-full px-8 py-14"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Page Header */}
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div className="flex flex-col gap-3">
            <h1
              className="text-[2.75rem] font-semibold leading-tight tracking-tight text-foreground"
              data-testid="heading-projects"
            >
              Your Projects
            </h1>
            <p className="text-lg text-muted-foreground">
              Track and manage client projects from start to finish.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-56 rounded-full bg-card border-border"
                data-testid="input-search-projects"
              />
            </div>
            {isDesigner && (
              <button
                onClick={onAddProject}
                data-testid="button-add-project"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
                style={{ background: "#0071e3" }}
              >
                <Plus className="h-[11px] w-[11px]" strokeWidth={2.5} />
                Add Project
              </button>
            )}
          </div>
        </div>

        {/* Project List */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-center" data-testid="text-no-projects">
              No projects found.
            </p>
            {isDesigner && (
              <button
                onClick={onAddProject}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white"
                style={{ background: "#0071e3" }}
                data-testid="button-add-first-project"
              >
                <Plus className="h-[11px] w-[11px]" strokeWidth={2.5} />
                Add First Project
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {/* List header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-2 bg-muted/40 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-40 text-right hidden sm:block">Timeline</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20 text-center hidden md:block">Vendors</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20 text-center hidden md:block">Status</span>
              {isDesigner && <span className="w-16" />}
            </div>

            {filteredProjects.map((project, index) => {
              const active = isProjectActive(project);
              const progress = calcProgress(project.startDate, project.endDate);
              const isSelected = selectedProject === project.id;
              const quoteCount = quotations[project.id]?.length || 0;

              return (
                <div
                  key={project.id}
                  data-testid={`project-item-${project.id}`}
                  onClick={() => setSelectedProject(isSelected ? null : project.id)}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover-elevate border-b border-border last:border-b-0 ${isSelected ? "bg-blue-50 dark:bg-blue-950/20" : "bg-background"}`}
                >
                  {/* Name & client */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" data-testid="text-project-name">
                      {project.projectName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" data-testid="text-client-name">
                      {project.clientName}
                    </p>
                  </div>

                  {/* Timeline */}
                  <div className="w-40 text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground" data-testid="text-start-date">
                      {formatDateShort(project.startDate)}
                      {project.endDate && (
                        <> → <span data-testid="text-end-date">{formatDateShort(project.endDate)}</span></>
                      )}
                    </p>
                    <div className="w-full h-1 rounded-full mt-1 overflow-hidden bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${progress}%`, background: "#0071e3" }}
                      />
                    </div>
                  </div>

                  {/* Vendors + Quotes */}
                  <div className="w-20 text-center hidden md:block">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{project.vendorCount}</span> vendors
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{quoteCount}</span> quotes
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="w-20 flex justify-center hidden md:flex">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        background: active ? "#dcfce7" : "#f3f4f6",
                        color: active ? "#166534" : "#6b7280",
                      }}
                      data-testid="badge-project-status"
                    >
                      {active ? "Active" : "Done"}
                    </span>
                  </div>

                  {/* Actions */}
                  {isDesigner && (
                    <div className="w-16 flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditProject?.(project); }}
                        data-testid="button-edit-project"
                        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteProject?.(project); }}
                        data-testid="button-delete-project"
                        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Project Quotations Panel */}
        {selectedProjectData && (() => {
          const selectedQuotations = selectedProjectQuotations
            .filter(q => q.status === "Selected")
            .sort((a, b) => (a.category || "").localeCompare(b.category || ""));
          const selectedTotal = selectedQuotations.reduce(
            (sum, q) => sum + parseFloat(q.quotationValue || "0"), 0
          );

          return (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Selected Vendors
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedProjectData.projectName}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border hover-elevate"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {selectedQuotations.length > 0 ? (
                <>
                  {/* Total banner */}
                  <div
                    className="flex items-center justify-between px-5 py-3 rounded-[12px] mb-4"
                    style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" style={{ color: "#0284c7" }} />
                      <span className="text-sm font-medium" style={{ color: "#0c4a6e" }}>
                        {selectedQuotations.length} vendor{selectedQuotations.length !== 1 ? "s" : ""} selected
                      </span>
                    </div>
                    <span className="font-mono font-bold text-base" style={{ color: "#0c4a6e" }}
                      data-testid="text-selected-total">
                      {formatCurrencyCompact(selectedTotal)}
                    </span>
                  </div>

                  <div
                    className="bg-white dark:bg-card rounded-[16px] overflow-hidden"
                    style={{ border: "1px solid #f3f4f6", boxShadow: "0 4px 16px 0 rgba(0,0,0,0.04)" }}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Quote Value</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const groups: Record<string, typeof selectedQuotations> = {};
                          selectedQuotations.forEach(q => {
                            const cat = q.category || "Uncategorised";
                            if (!groups[cat]) groups[cat] = [];
                            groups[cat].push(q);
                          });
                          return Object.entries(groups).map(([category, quotes]) => (
                            <>
                              <TableRow key={`cat-${category}`} className="bg-muted/40 hover:bg-muted/40">
                                <TableCell colSpan={5} className="py-2 px-4">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {category}
                                  </span>
                                </TableCell>
                              </TableRow>
                              {quotes.map(q => (
                                <QuotationRow key={q.id} quotation={q} hideCategory />
                              ))}
                            </>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div
                  className="bg-white dark:bg-card rounded-[16px] py-12 flex flex-col items-center justify-center gap-3"
                  style={{ border: "1px solid #f3f4f6", boxShadow: "0 4px 16px 0 rgba(0,0,0,0.04)" }}
                >
                  <CheckCircle2 className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground" data-testid="text-no-quotations">
                    No vendors have been selected for this project yet.
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
