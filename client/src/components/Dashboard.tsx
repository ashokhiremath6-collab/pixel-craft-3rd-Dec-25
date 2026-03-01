import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Users, Building2, FileText, TrendingUp, ArrowRight, Clock, Download, Calendar, AlertCircle } from "lucide-react";
import type { Vendor, Project, ActivityLog, Task } from "@shared/schema";
import { formatCurrencyCompact, formatVendorNameWithProjectAndCategory } from "@/lib/currencyUtils";
import { format, differenceInDays, startOfDay } from "date-fns";

interface VendorWithCategory extends Omit<Vendor, 'categoryName'> {
  category: string;
}

interface QuotationItem {
  id: string;
  vendorName: string;
  projectName: string;
  quotationValue: string;
  status: "Quoted" | "Selected" | "Rejected";
  dateOfQuotation: string;
  category?: string;
  quotationName?: string;
  quotationType?: string;
  uploaderName?: string | null;
  uploadedAt?: string | null;
}

interface TaskWithMeta extends Task {
  projectName: string;
  daysUntilStart?: number;
  daysToGo?: number;
  daysOverdue?: number;
}

interface DashboardProps {
  vendors: VendorWithCategory[];
  projects: Project[];
  recentQuotations: QuotationItem[];
  allQuotations?: QuotationItem[];
  activities?: ActivityLog[];
  taskAlerts?: {
    upcomingStart: TaskWithMeta[];
    completionCountdown: TaskWithMeta[];
    overdue: TaskWithMeta[];
  };
  onNavigate?: (path: string) => void;
}

function GlassStatCard({
  label,
  icon: Icon,
  value,
  subtext,
  onClick,
  testId,
}: {
  label: string;
  icon: React.ElementType;
  value: string | number;
  subtext: string;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <div
      onClick={onClick}
      data-testid={testId}
      className="flex flex-col gap-4 p-6 rounded-[20px] cursor-pointer select-none flex-1"
      style={{
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0px 4px 12px 0px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0px 1px 2px 0px rgba(0,0,0,0.05)")}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[13px] font-medium"
          style={{ color: "#86868b" }}
        >
          {label}
        </span>
        <Icon className="h-4 w-4" style={{ color: "#86868b" }} />
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-[36px] font-semibold leading-none"
          style={{ color: "#111827" }}
        >
          {value}
        </span>
        <span
          className="text-[12px]"
          style={{ color: "#86868b" }}
        >
          {subtext}
        </span>
      </div>
    </div>
  );
}

function ContentCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white dark:bg-card flex flex-col rounded-[24px] ${className}`}
      style={{
        border: "1px solid #f3f4f6",
        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    Selected: { bg: "#dcfce7", text: "#166534" },
    Quoted:   { bg: "#eff6ff", text: "#1d4ed8" },
    Rejected: { bg: "#fef2f2", text: "#991b1b" },
  };
  const c = colors[status] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

export default function Dashboard({
  vendors,
  projects,
  recentQuotations,
  allQuotations,
  activities = [],
  taskAlerts = { upcomingStart: [], completionCountdown: [], overdue: [] },
  onNavigate,
}: DashboardProps) {
  const [isQuotationDetailModalOpen, setIsQuotationDetailModalOpen] = useState(false);

  const handleNavigate = (path: string) => onNavigate?.(path);

  const vendorsByCategory = vendors.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeProjects = projects.filter(
    p => !p.endDate || new Date(p.endDate) > new Date()
  ).length;
  const completedProjects = projects.length - activeProjects;

  const selectedQuotations = (allQuotations || recentQuotations)
    .filter(q => q.status === "Selected")
    .sort((a, b) => {
      const ca = (a.category || "").toLowerCase();
      const cb = (b.category || "").toLowerCase();
      if (ca !== cb) return ca.localeCompare(cb);
      return a.vendorName.toLowerCase().localeCompare(b.vendorName.toLowerCase());
    });

  const totalQuotationValue = selectedQuotations.reduce(
    (sum, q) => sum + parseFloat(q.quotationValue || "0"),
    0
  );

  const hasAlerts =
    taskAlerts.upcomingStart.length > 0 ||
    taskAlerts.completionCountdown.length > 0 ||
    taskAlerts.overdue.length > 0;

  const getActivityLabel = (type: string) => {
    const labels: Record<string, string> = {
      floor_plan_upload: "Floor Plan", floor_plan_delete: "Floor Plan",
      moodboard_upload: "Moodboard", moodboard_delete: "Moodboard",
      render_upload: "Render", render_delete: "Render",
      working_drawing_upload: "Working Drawing", working_drawing_delete: "Working Drawing",
      quote_upload: "Quotation", quote_file_delete: "Quotation",
      schedule_upload: "Project Schedule",
      specification_upload: "Specification", specification_delete: "Specification",
      catalogue_upload: "Catalogue Item", catalogue_delete: "Catalogue Item",
      vendor_create: "Vendor", vendor_update: "Vendor", vendor_delete: "Vendor",
    };
    return labels[type] || type;
  };

  const getActivityVerb = (type: string) => {
    if (type.endsWith("_delete")) return "deleted";
    if (type.endsWith("_upload")) return "uploaded";
    if (type.endsWith("_create")) return "created";
    if (type.endsWith("_update")) return "updated";
    return "performed";
  };

  return (
    <div className="min-h-full px-8 py-14" style={{ background: "hsl(var(--background))" }}>
      <div className="max-w-[1280px] mx-auto flex flex-col gap-12">

        {/* ── Page Header ── */}
        <div className="flex flex-col gap-3">
          <h1
            className="font-semibold leading-none"
            style={{ fontSize: "clamp(2rem,4vw,3.75rem)", color: "#111827", letterSpacing: "-1.5px" }}
            data-testid="heading-dashboard"
          >
            PixelCraft Designer
          </h1>
          <p className="text-[20px]" style={{ color: "#86868b" }}>
            Overview of your vendors, projects, and quotations.
          </p>
        </div>

        {/* ── Glassmorphism Stat Cards ── */}
        <div className="flex gap-6">
          <GlassStatCard
            label="Total Vendors"
            icon={Users}
            value={vendors.length}
            subtext="In database"
            onClick={() => handleNavigate("/vendors")}
            testId="stat-total-vendors"
          />
          <GlassStatCard
            label="Active Projects"
            icon={Building2}
            value={activeProjects}
            subtext={`${completedProjects} completed`}
            onClick={() => handleNavigate("/projects")}
            testId="stat-active-projects"
          />
          <GlassStatCard
            label="Total Quotations"
            icon={FileText}
            value={formatCurrencyCompact(totalQuotationValue)}
            subtext="Selected"
            onClick={() => setIsQuotationDetailModalOpen(true)}
            testId="stat-total-quotations"
          />
          <GlassStatCard
            label="Categories"
            icon={TrendingUp}
            value={Object.keys(vendorsByCategory).length}
            subtext="Vendor types"
            onClick={() => handleNavigate("/vendors")}
            testId="stat-categories"
          />
        </div>

        {/* ── Two-Column Main Content ── */}
        <div className="flex gap-8 items-start">

          {/* Left Column */}
          <div className="flex flex-col gap-8 flex-1 min-w-0">

            {/* Recent Quotations */}
            <ContentCard>
              <div className="flex items-center justify-between px-8 pt-8 pb-4">
                <h2 className="text-[24px] font-semibold" style={{ color: "#111827" }}>
                  Recent Quotations
                </h2>
                <button
                  onClick={() => handleNavigate("/quotes")}
                  data-testid="button-view-all-quotes"
                  className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#0071e3" }}
                >
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {recentQuotations.length === 0 ? (
                <div className="px-8 pb-8 text-sm text-center py-10" style={{ color: "#86868b" }}>
                  No quotations yet.
                </div>
              ) : (
                <div className="px-8 pb-8 flex flex-col gap-3">
                  {recentQuotations.slice(0, 6).map(q => (
                    <div
                      key={q.id}
                      data-testid={`recent-quotation-${q.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 rounded-[12px]"
                      style={{ background: "#f9fafb" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "#111827" }}>
                          {formatVendorNameWithProjectAndCategory(q.vendorName, q.projectName, q.category)}
                          {q.quotationName && q.quotationName !== "Main Quote" && (
                            <span className="ml-1 font-normal" style={{ color: "#86868b" }}>
                              — {q.quotationName}
                            </span>
                          )}
                          {q.uploaderName && (
                            <span className="ml-2 text-xs text-red-500">new — {q.uploaderName}</span>
                          )}
                        </div>
                        {q.uploadedAt && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: "#86868b" }}>
                            <Clock className="h-3 w-3" />
                            {format(new Date(q.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-mono font-semibold text-sm" style={{ color: "#111827" }}>
                          {formatCurrencyCompact(parseFloat(q.quotationValue))}
                        </span>
                        <StatusPill status={q.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ContentCard>

            {/* Recent Activity */}
            {activities.length > 0 && (
              <ContentCard>
                <div className="px-8 pt-8 pb-4">
                  <h2 className="text-[24px] font-semibold" style={{ color: "#111827" }}>
                    Recent Activity
                  </h2>
                </div>
                <div className="px-8 pb-8 flex flex-col gap-2">
                  {activities.slice(0, 8).map(activity => {
                    const proj = projects.find(p => p.id === activity.projectId);
                    return (
                      <div
                        key={activity.id}
                        data-testid={`activity-${activity.id}`}
                        className="flex items-start gap-3 px-4 py-3 rounded-[12px]"
                        style={{ background: "#f9fafb" }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap text-sm">
                            <span className="font-medium" style={{ color: "#111827" }}
                              data-testid={`text-user-${activity.id}`}>
                              {activity.userName}
                            </span>
                            <span style={{ color: "#86868b" }}>{getActivityVerb(activity.activityType)}</span>
                            <span className="font-medium" style={{ color: "#0071e3" }}
                              data-testid={`text-type-${activity.id}`}>
                              {getActivityLabel(activity.activityType)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: "#86868b" }}>
                            {activity.fileName && (
                              <span className="truncate" data-testid={`text-filename-${activity.id}`}>
                                {activity.fileName}
                              </span>
                            )}
                            {proj && (
                              <>
                                <span>•</span>
                                <span data-testid={`text-project-${activity.id}`}>{proj.projectName}</span>
                              </>
                            )}
                            <span>•</span>
                            <span data-testid={`text-time-${activity.id}`}>
                              {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ContentCard>
            )}
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-8 w-[360px] flex-shrink-0">

            {/* Task Alerts */}
            {hasAlerts && (
              <ContentCard>
                <div className="px-6 pt-6 pb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <h2 className="text-[18px] font-semibold" style={{ color: "#111827" }}>
                    Task Alerts
                  </h2>
                </div>
                <div className="px-6 pb-6 flex flex-col gap-4">

                  {/* Upcoming Start */}
                  {taskAlerts.upcomingStart.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                          Starting Soon
                        </span>
                        <span className="text-xs" style={{ color: "#86868b" }}>
                          {taskAlerts.upcomingStart.length} task{taskAlerts.upcomingStart.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {taskAlerts.upcomingStart.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            data-testid={`alert-start-${task.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px]"
                            style={{ background: "#eff6ff" }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: "#1e3a8a" }}
                                data-testid={`text-task-name-${task.id}`}>
                                {task.name}
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: "#3b82f6" }}
                                data-testid={`text-project-${task.id}`}>
                                {task.projectName}
                                {task.startDate && ` • ${format(new Date(task.startDate), "dd MMM")}`}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: "#dbeafe", color: "#1d4ed8" }}>
                              {task.daysUntilStart === 0 ? "Today" : task.daysUntilStart === 1 ? "Tomorrow" : `${task.daysUntilStart}d`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completion Countdown */}
                  {taskAlerts.completionCountdown.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: "#fff7ed", color: "#c2410c" }}>
                          Due Soon
                        </span>
                        <span className="text-xs" style={{ color: "#86868b" }}>
                          {taskAlerts.completionCountdown.length} task{taskAlerts.completionCountdown.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {taskAlerts.completionCountdown.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            data-testid={`alert-countdown-${task.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px]"
                            style={{ background: "#fff7ed" }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: "#7c2d12" }}
                                data-testid={`text-task-name-${task.id}`}>
                                {task.name}
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: "#ea580c" }}
                                data-testid={`text-project-${task.id}`}>
                                {task.projectName}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: "#fed7aa", color: "#c2410c" }}>
                              {task.daysToGo}d left
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Overdue */}
                  {taskAlerts.overdue.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: "#fef2f2", color: "#991b1b" }}>
                          Overdue
                        </span>
                        <span className="text-xs" style={{ color: "#86868b" }}>
                          {taskAlerts.overdue.length} task{taskAlerts.overdue.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {taskAlerts.overdue.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            data-testid={`alert-overdue-${task.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px]"
                            style={{ background: "#fef2f2" }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: "#7f1d1d" }}
                                data-testid={`text-task-name-${task.id}`}>
                                {task.name}
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: "#ef4444" }}
                                data-testid={`text-project-${task.id}`}>
                                {task.projectName}
                                {task.endDate && ` • Due ${format(new Date(task.endDate), "dd MMM")}`}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: "#fecaca", color: "#991b1b" }}>
                              {task.daysOverdue}d
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ContentCard>
            )}

            {/* Vendor Categories */}
            {Object.keys(vendorsByCategory).length > 0 && (
              <ContentCard>
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-[18px] font-semibold" style={{ color: "#111827" }}>
                    Vendor Categories
                  </h2>
                </div>
                <div className="px-6 pb-6 flex flex-col gap-2">
                  {Object.entries(vendorsByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, count]) => {
                      const maxCount = Math.max(...Object.values(vendorsByCategory));
                      const pct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={category} className="flex items-center gap-3">
                          <span className="text-xs flex-1 truncate" style={{ color: "#374151" }}>
                            {category}
                          </span>
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: "#0071e3" }}
                            />
                          </div>
                          <span className="text-xs font-medium w-4 text-right" style={{ color: "#86868b" }}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </ContentCard>
            )}
          </div>
        </div>

      </div>

      {/* ── Quotation Breakdown Modal ── */}
      <Dialog open={isQuotationDetailModalOpen} onOpenChange={setIsQuotationDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>Project Cost Breakdown</DialogTitle>
            {selectedQuotations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/quotations/export-cost-breakdown", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ quotations: selectedQuotations }),
                    });
                    if (!res.ok) throw new Error("Export failed");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Project_Cost_Breakdown_${new Date().toISOString().split("T")[0]}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch {}
                }}
                data-testid="button-export-project-cost"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </DialogHeader>
          <div className="space-y-4">
            {selectedQuotations.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px] font-semibold">Vendor</TableHead>
                        <TableHead className="w-[140px] font-semibold">Project</TableHead>
                        <TableHead className="w-[140px] font-semibold">Category</TableHead>
                        <TableHead className="w-[100px] text-right font-semibold">Rs lacs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuotations.map(q => (
                        <TableRow key={q.id} data-testid={`quotation-line-${q.id}`} className="hover:bg-muted/30">
                          <TableCell className="font-medium py-3">{q.vendorName}</TableCell>
                          <TableCell className="py-3">{q.projectName}</TableCell>
                          <TableCell className="py-3 text-muted-foreground">{q.category || "—"}</TableCell>
                          <TableCell className="text-right py-3 font-mono font-semibold tabular-nums">
                            {(parseFloat(q.quotationValue || "0") / 100000).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t-2 border-primary/20 pt-4 bg-muted/30 -mx-6 px-6 pb-2 rounded-b-lg">
                  <div className="flex items-center justify-between font-semibold text-lg">
                    <span>Total Project Cost</span>
                    <span className="font-mono text-xl tabular-nums" data-testid="modal-total-quotations">
                      {(totalQuotationValue / 100000).toFixed(2)} lacs
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedQuotations.length} vendor{selectedQuotations.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No selected quotations to display</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
