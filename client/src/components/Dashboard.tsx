import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Users, Building2, FileText, TrendingUp, ArrowRight, Clock, Download,
  AlertCircle, ImageIcon, LayoutDashboard, FileCheck2, CalendarDays,
  BookOpen, Package, Trash2, Pencil, Plus, Bell, FileUp,
} from "lucide-react";
import type { Vendor, Project, ActivityLog, Task } from "@shared/schema";
import { formatCurrencyCompact, formatVendorNameWithProjectAndCategory } from "@/lib/currencyUtils";
import { format, formatDistanceToNow, differenceInHours, differenceInDays, startOfDay } from "date-fns";

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

interface ProjectTaskBreakdownEntry {
  projectId: string;
  projectName: string;
  total: number;
  completed: number;
  remaining: number;
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
  totalActiveTasks?: number;
  projectTaskBreakdown?: ProjectTaskBreakdownEntry[];
  onNavigate?: (path: string) => void;
}

const ACTIVITY_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  accent: string;
  iconBg: string;
  iconColor: string;
}> = {
  floor_plan_upload:        { label: "Floor Plan",        icon: LayoutDashboard, accent: "#eff6ff", iconBg: "#dbeafe", iconColor: "#1d4ed8" },
  floor_plan_delete:        { label: "Floor Plan",        icon: LayoutDashboard, accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  moodboard_upload:         { label: "Moodboard",         icon: ImageIcon,       accent: "#f5f3ff", iconBg: "#ddd6fe", iconColor: "#7c3aed" },
  moodboard_delete:         { label: "Moodboard",         icon: ImageIcon,       accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  render_upload:            { label: "Render",            icon: ImageIcon,       accent: "#f0fdf4", iconBg: "#bbf7d0", iconColor: "#15803d" },
  render_delete:            { label: "Render",            icon: ImageIcon,       accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  working_drawing_upload:   { label: "Working Drawing",   icon: FileCheck2,      accent: "#fff7ed", iconBg: "#fed7aa", iconColor: "#c2410c" },
  working_drawing_delete:   { label: "Working Drawing",   icon: FileCheck2,      accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  quote_upload:             { label: "Quotation",         icon: FileText,        accent: "#f0fdf4", iconBg: "#bbf7d0", iconColor: "#15803d" },
  quote_file_delete:        { label: "Quotation",         icon: FileText,        accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  schedule_upload:          { label: "Project Schedule",  icon: CalendarDays,    accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  schedule_reimport:        { label: "Project Schedule",  icon: CalendarDays,    accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  schedule_delete:          { label: "Project Schedule",  icon: CalendarDays,    accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  schedule:                 { label: "Schedule Update",   icon: CalendarDays,    accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  specification_upload:     { label: "Specification",     icon: BookOpen,        accent: "#fdf4ff", iconBg: "#e9d5ff", iconColor: "#7e22ce" },
  specification_delete:     { label: "Specification",     icon: BookOpen,        accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  catalogue_upload:         { label: "Catalogue Item",    icon: Package,         accent: "#fefce8", iconBg: "#fef08a", iconColor: "#a16207" },
  catalogue_delete:         { label: "Catalogue Item",    icon: Package,         accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  vendor_create:            { label: "Vendor",            icon: Users,           accent: "#f0fdf4", iconBg: "#bbf7d0", iconColor: "#15803d" },
  vendor_update:            { label: "Vendor",            icon: Users,           accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  vendor_delete:            { label: "Vendor",            icon: Users,           accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
};

function getActivityConfig(type: string) {
  return ACTIVITY_CONFIG[type] ?? {
    label: type,
    icon: FileUp,
    accent: "#f9fafb",
    iconBg: "#f3f4f6",
    iconColor: "#6b7280",
  };
}

function getActivityVerb(type: string) {
  if (type === "schedule_reimport") return "re-imported";
  if (type.endsWith("_delete")) return "deleted";
  if (type.endsWith("_upload")) return "uploaded";
  if (type.endsWith("_create")) return "added";
  if (type.endsWith("_update")) return "updated";
  return "updated";
}

function relativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const hoursAgo = differenceInHours(new Date(), date);
  if (hoursAgo < 1) return "just now";
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  if (hoursAgo < 48) return "yesterday";
  return format(date, "d MMM");
}

function isVeryRecent(dateStr: string) {
  return differenceInHours(new Date(), new Date(dateStr)) < 12;
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
  totalActiveTasks = 0,
  projectTaskBreakdown = [],
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

  const sortedActivities = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-full px-4 py-6 sm:px-8 sm:py-10" style={{ background: "hsl(var(--background))" }}>
      <div className="max-w-[1280px] mx-auto flex flex-col gap-6 sm:gap-10">

        {/* ── Page Header ── */}
        <div className="flex flex-col gap-1">
          <h1
            className="font-semibold leading-none"
            style={{ fontSize: "clamp(1.5rem,4vw,3.75rem)", color: "#111827", letterSpacing: "-1px" }}
            data-testid="heading-dashboard"
          >
            PixelCraft Designer
          </h1>
          <p className="text-sm sm:text-[18px]" style={{ color: "#86868b" }}>
            Overview of your vendors, projects, and quotations.
          </p>
        </div>

        {/* ── Latest Activity — PROMINENT HERO SECTION ── */}
        <ContentCard>
          <div className="flex items-center justify-between px-5 sm:px-8 pt-6 pb-3 gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "#0071e3" }}>
                <Bell className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-[22px] font-semibold leading-tight" style={{ color: "#111827" }}>
                  Latest Activity
                </h2>
                <p className="text-xs" style={{ color: "#86868b" }}>
                  Drawings, quotes, schedules and more — everything uploaded across all projects
                </p>
              </div>
            </div>
            {sortedActivities.length > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                {sortedActivities.length} event{sortedActivities.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {sortedActivities.length === 0 ? (
            <div className="px-8 pb-8 pt-4 text-sm text-center" style={{ color: "#86868b" }}>
              No activity recorded yet. Upload a drawing, quote or schedule to see it here.
            </div>
          ) : (
            <div className="px-4 sm:px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedActivities.slice(0, 18).map(activity => {
                const cfg = getActivityConfig(activity.activityType);
                const IconComp = cfg.icon;
                const proj = projects.find(p => p.id === activity.projectId);
                const activityMeta = activity.metadata as { projectName?: string | null } | null;
                const projectName = proj?.projectName ?? activityMeta?.projectName ?? null;
                const recent = isVeryRecent(activity.createdAt);
                const verb = getActivityVerb(activity.activityType);

                return (
                  <div
                    key={activity.id}
                    data-testid={`activity-${activity.id}`}
                    className="flex items-start gap-3 px-4 py-3.5 rounded-[14px] relative"
                    style={{ background: cfg.accent, border: `1px solid ${cfg.iconBg}` }}
                  >
                    {/* New indicator dot */}
                    {recent && (
                      <span
                        className="absolute top-3 right-3 w-2 h-2 rounded-full"
                        style={{ background: "#0071e3" }}
                        title="Very recent"
                      />
                    )}

                    {/* Icon */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-[10px]"
                      style={{ background: cfg.iconBg }}
                    >
                      <IconComp className="h-4 w-4" style={{ color: cfg.iconColor }} />
                    </div>

                    <div className="flex-1 min-w-0 pr-3">
                      {/* Type badge + verb */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cfg.iconColor }}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px]" style={{ color: "#6b7280" }}>{verb}</span>
                      </div>

                      {/* File name */}
                      {activity.fileName && (
                        <div
                          className="text-sm font-medium mt-0.5 truncate"
                          style={{ color: "#111827" }}
                          data-testid={`text-filename-${activity.id}`}
                          title={activity.fileName}
                        >
                          {activity.fileName}
                        </div>
                      )}

                      {/* Who + project + time */}
                      <div className="flex items-center gap-1 flex-wrap mt-1" style={{ color: "#86868b" }}>
                        <span className="text-xs font-medium" style={{ color: "#374151" }} data-testid={`text-user-${activity.id}`}>
                          {activity.userName}
                        </span>
                        {projectName && (
                          <>
                            <span className="text-xs">·</span>
                            <span className="text-xs truncate max-w-[100px]" data-testid={`text-project-${activity.id}`}>
                              {projectName}
                            </span>
                          </>
                        )}
                        <span className="text-xs">·</span>
                        <span className="text-xs whitespace-nowrap" data-testid={`text-time-${activity.id}`}>
                          {relativeTime(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ContentCard>

        {/* ── Two-Column Lower Content ── */}
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">

          {/* Left Column */}
          <div className="flex flex-col gap-6 sm:gap-8 flex-1 min-w-0 w-full">

            {/* Recent Quotations */}
            <ContentCard>
              <div className="flex items-center justify-between px-4 sm:px-8 pt-5 sm:pt-8 pb-3 sm:pb-4 flex-wrap gap-2">
                <h2 className="text-lg sm:text-[22px] font-semibold" style={{ color: "#111827" }}>
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
                <div className="px-4 sm:px-8 pb-5 sm:pb-8 text-sm text-center py-8 sm:py-10" style={{ color: "#86868b" }}>
                  No quotations yet.
                </div>
              ) : (
                <div className="px-4 sm:px-8 pb-5 sm:pb-8 flex flex-col gap-3">
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

            {/* Summary stat strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Vendors", value: vendors.length, sub: "in database", onClick: () => handleNavigate("/vendors"), testId: "stat-total-vendors" },
                { label: "Active Projects", value: activeProjects, sub: `${completedProjects} completed`, onClick: () => handleNavigate("/projects"), testId: "stat-active-projects" },
                { label: "Active Tasks", value: totalActiveTasks, sub: "from schedules", onClick: () => handleNavigate("/gantt"), testId: "stat-active-tasks" },
                { label: "Selected Value", value: formatCurrencyCompact(totalQuotationValue), sub: "quotations", onClick: () => setIsQuotationDetailModalOpen(true), testId: "stat-total-quotations" },
                { label: "Categories", value: Object.keys(vendorsByCategory).length, sub: "vendor types", onClick: () => handleNavigate("/vendors"), testId: "stat-categories" },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={s.onClick}
                  data-testid={s.testId}
                  className="flex flex-col gap-1 p-4 rounded-[16px] text-left transition-shadow hover:shadow-md"
                  style={{
                    background: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.5)",
                    boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                  }}
                >
                  <span className="text-[12px] font-medium" style={{ color: "#86868b" }}>{s.label}</span>
                  <span className="text-[26px] font-bold leading-none" style={{ color: "#111827" }}>{s.value}</span>
                  <span className="text-[11px]" style={{ color: "#9ca3af" }}>{s.sub}</span>
                </button>
              ))}
            </div>

            {/* Project Task Breakdown */}
            {projectTaskBreakdown.length > 0 && (
              <ContentCard>
                <div className="px-6 pt-6 pb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" style={{ color: "#6366f1" }} />
                  <h2 className="text-[18px] font-semibold" style={{ color: "#111827" }}>
                    Tasks by Project
                  </h2>
                </div>
                <div className="px-6 pb-6 flex flex-col gap-3" data-testid="project-task-breakdown">
                  {projectTaskBreakdown.map(entry => {
                    const pct = entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0;
                    return (
                      <button
                        key={entry.projectId}
                        data-testid={`breakdown-project-${entry.projectId}`}
                        onClick={() => handleNavigate(`/gantt?projectId=${entry.projectId}`)}
                        className="w-full text-left flex flex-col gap-1.5 p-3 rounded-[12px] hover-elevate active-elevate-2"
                        style={{ background: "#f9fafb" }}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-medium truncate flex-1 min-w-0" style={{ color: "#111827" }}>
                            {entry.projectName}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[11px] font-semibold" style={{ color: "#6366f1" }}>
                              {entry.completed}/{entry.total}
                            </span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: entry.remaining === 0 ? "#dcfce7" : "#eff6ff", color: entry.remaining === 0 ? "#166534" : "#1d4ed8" }}>
                              {entry.remaining === 0 ? "Done" : `${entry.remaining} left`}
                            </span>
                          </div>
                        </div>
                        <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "#e5e7eb" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : "#6366f1" }}
                          />
                        </div>
                        <span className="text-[10px]" style={{ color: "#9ca3af" }}>{pct}% complete</span>
                      </button>
                    );
                  })}
                </div>
              </ContentCard>
            )}
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6 sm:gap-8 w-full lg:w-[340px] lg:flex-shrink-0">

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
