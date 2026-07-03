import { useState, useEffect } from "react";
import { Building2, Users, BarChart3, Settings, Home, FileText, Upload, Map, UserCheck, ImageIcon, PenTool, Sparkles, GanttChart, DollarSign, Wallet, BookOpen, Calendar, FileSignature, Wand2, Camera, BrainCircuit, User, Receipt, ClipboardList, Lightbulb, PackageCheck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface NavigationItem {
  title: string;
  url: string;
  icon: typeof Home;
}

const mainItems: NavigationItem[] = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Projects", url: "/projects", icon: Building2 },
  { title: "Project Cost", url: "/project-cost", icon: Receipt },
  { title: "Project scheduling", url: "/gantt-chart", icon: GanttChart },
  { title: "Moodboards", url: "/moodboards", icon: ImageIcon },
  { title: "Renders", url: "/renders", icon: Sparkles },
  { title: "Concept Drawings", url: "/concept-drawings", icon: Lightbulb },
  { title: "Working Drawings", url: "/working-drawings", icon: PenTool },
  { title: "Vendors by Category", url: "/vendors", icon: Users },
  { title: "Comparative Quotes", url: "/quotes", icon: BarChart3 },
  { title: "Unit Rate Quotes", url: "/unit-rates", icon: DollarSign },
  { title: "Import Quotes", url: "/import", icon: Upload },
  { title: "Quote Templates", url: "/templates", icon: FileText },
  { title: "Works Orders", url: "/works-orders", icon: FileSignature },
  { title: "Accounts", url: "/accounts", icon: Wallet },
  { title: "SOPs", url: "/sops", icon: BookOpen },
  { title: "Design Intelligence", url: "/ai-assistant", icon: BrainCircuit },
  { title: "AI Renders", url: "/ai-renders", icon: Wand2 },
  { title: "Asset Ingestion", url: "/asset-ingestion", icon: Camera },
  { title: "Catalogues", url: "/catalogue", icon: BookOpen },
  { title: "Specifications", url: "/specifications", icon: FileText },
  { title: "Accessories Checklist", url: "/accessories-checklist", icon: PackageCheck },
  { title: "Meeting Minutes", url: "/meeting-minutes", icon: Calendar },
];

// Reduced nav for project managers — only what pertains to their role
const projectManagerMainItems: NavigationItem[] = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Project scheduling", url: "/gantt-chart", icon: GanttChart },
  { title: "Working Drawings", url: "/working-drawings", icon: PenTool },
  { title: "SOPs", url: "/sops", icon: BookOpen },
];

const settingsItems: NavigationItem[] = [
  { title: "Settings", url: "/settings", icon: Settings },
];

const accountItems: NavigationItem[] = [
  { title: "Account", url: "/account", icon: User },
];

const projectManagerItems: NavigationItem[] = [
  { title: "Works Orders", url: "/works-orders", icon: FileSignature },
  { title: "Meeting Minutes", url: "/meeting-minutes", icon: Calendar },
];

export function AppSidebar({ previewRole }: { previewRole?: string } = {}) {
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const [logoError, setLogoError] = useState(false);

  const role = previewRole || ((user as any)?.role as string | undefined);
  const orgId = (user as any)?.orgId as string | undefined;

  const { data: org } = useQuery<{ name: string; logoUrl?: string | null }>({
    queryKey: ["/api/organisations", orgId],
    queryFn: () => fetch(`/api/organisations/${orgId}`).then(r => r.json()),
    enabled: !!orgId,
  });

  // Reset error state whenever the logo URL changes (e.g. after upload)
  useEffect(() => {
    setLogoError(false);
  }, [org?.logoUrl]);
  const isAdminOrDesigner = role === 'admin' || role === 'designer';
  const isProjectManager = role === 'project_manager';

  // Choose which main items to show based on role
  const visibleMainItems = isProjectManager ? projectManagerMainItems : mainItems;

  // Poll for client_paid payment requests — same cadence as PaymentAlertsPanel
  const { data: paymentAlerts = [] } = useQuery<unknown[]>({
    queryKey: ["/api/dashboard/payment-alerts"],
    refetchInterval: 60_000,
    enabled: isAdminOrDesigner,
  });

  const pendingPaymentCount = paymentAlerts.length;

  // Close mobile sidebar when a link is clicked
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderMenuItems = (items: NavigationItem[], badgeCounts: Record<string, number> = {}) =>
    items.map((item) => {
      const badge = badgeCounts[item.url] ?? 0;
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            data-active={location === item.url}
            data-testid={`sidebar-link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Link href={item.url} onClick={handleLinkClick}>
              <item.icon />
              <span className="flex-1">{item.title}</span>
              {badge > 0 && (
                <span
                  className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
                  data-testid={`badge-${item.url.replace(/\//g, '')}-count`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  const accountsBadgeCounts = isAdminOrDesigner && pendingPaymentCount > 0
    ? { "/accounts": pendingPaymentCount }
    : {};

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="px-3 py-3 border-b">
        <div className="flex items-center gap-2.5">
          {org?.logoUrl && !logoError ? (
            <img
              src={org.logoUrl}
              alt={org.name}
              title={org.name}
              className="shrink-0 rounded-sm object-contain group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:max-w-[32px]"
              style={{ height: 44, width: "auto", maxWidth: 150 }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <div
              className="shrink-0 rounded-sm bg-muted flex items-center justify-center text-muted-foreground font-semibold group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
              style={{ height: 44, width: 44, fontSize: "1.1rem" }}
              title={org?.name || "Studio"}
            >
              {(org?.name || "S").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="font-bold leading-snug" style={{ fontSize: "0.78rem" }}>
              {org?.name || "Studio"}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: "0.64rem" }}>Interior Design</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="pb-4">
        {isAdminOrDesigner && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Project Brief
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild data-active={location === "/project-brief"} data-testid="sidebar-link-project-brief">
                    <Link href="/project-brief" onClick={handleLinkClick}>
                      <FileText />
                      <span>Briefs &amp; Proposals</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(visibleMainItems, accountsBadgeCounts)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdminOrDesigner && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={location === "/client-access"}
                    data-testid="sidebar-link-client-access"
                  >
                    <Link href="/client-access" onClick={handleLinkClick}>
                      <UserCheck />
                      <span>Client Access</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isProjectManager && (
          <SidebarGroup>
            <SidebarGroupLabel>Project Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItems(projectManagerItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {renderMenuItems(accountItems)}
          {isAdminOrDesigner && renderMenuItems(settingsItems)}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
