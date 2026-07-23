import { useState, useEffect } from "react";
import { Building2, Users, BarChart3, Settings, Home, FileText, Upload, Map, UserCheck, ImageIcon, PenTool, Sparkles, GanttChart, DollarSign, Wallet, BookOpen, Calendar, FileSignature, Wand2, Camera, BrainCircuit, User, Receipt, ClipboardList, Lightbulb, PackageCheck, ChevronDown, Check, MessageSquare, HelpCircle } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  { title: "Chat", url: "/chat", icon: MessageSquare },
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
  { title: "User Guide", url: "/user-guide", icon: HelpCircle },
];

const projectManagerItems: NavigationItem[] = [
  { title: "Works Orders", url: "/works-orders", icon: FileSignature },
  { title: "Meeting Minutes", url: "/meeting-minutes", icon: Calendar },
];

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

export function AppSidebar({ previewRole }: { previewRole?: string } = {}) {
  const [location] = useLocation();
  const [, navigate] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const queryClient = useQueryClient();

  const role = previewRole || ((user as any)?.role as string | undefined);
  const orgId = (user as any)?.orgId as string | undefined;
  const userId = (user as any)?.id as string | undefined;

  // Poll unread message count every 60 seconds (server computes from DB read receipts)
  const { data: unreadData, refetch: refetchUnread } = useQuery<{ total: number; byProject: { projectId: string; projectName: string; count: number }[] }>({
    queryKey: ["/api/messages/unread"],
    queryFn: () => fetch("/api/messages/unread", { credentials: "include" }).then(r => r.json()),
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 0,
  });

  // Re-fetch when user visits Chat page (fires "chatRead" event)
  useEffect(() => {
    const onChatRead = () => refetchUnread();
    window.addEventListener("chatRead", onChatRead);
    return () => window.removeEventListener("chatRead", onChatRead);
  }, [refetchUnread]);

  const unreadChatCount = unreadData?.total ?? 0;

  const { data: org } = useQuery<{ name: string; logoUrl?: string | null }>({
    queryKey: ["/api/organisations", orgId],
    queryFn: () => fetch(`/api/organisations/${orgId}`).then(r => r.json()),
    enabled: !!orgId,
  });

  const { data: userOrgs = [] } = useQuery<OrgSummary[]>({
    queryKey: ["/api/user/orgs"],
    enabled: !!(user as any)?.id,
  });

  const switchOrgMutation = useMutation({
    mutationFn: (targetOrgId: string) =>
      apiRequest("POST", "/api/user/switch-org", { orgId: targetOrgId }),
    onSuccess: () => {
      queryClient.clear();
      navigate("/");
      window.location.reload();
    },
  });

  const multiOrg = userOrgs.length > 1;

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

  const navBadgeCounts: Record<string, number> = {};
  if (isAdminOrDesigner && pendingPaymentCount > 0) navBadgeCounts["/accounts"] = pendingPaymentCount;
  if (unreadChatCount > 0) navBadgeCounts["/chat"] = unreadChatCount;

  const orgLogo = org?.logoUrl && !logoError ? (
    <img
      src={`/api/organisations/${orgId}/logo`}
      alt={org.name}
      title={org.name}
      className="shrink-0 rounded-md object-contain group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:max-w-[32px]"
      style={{ height: 72, width: "auto", maxWidth: 180, boxShadow: "0 1px 6px 0 rgba(0,0,0,0.18)" }}
      onError={() => setLogoError(true)}
    />
  ) : (
    <div
      className="shrink-0 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-extrabold group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
      style={{ height: 72, width: 72, fontSize: "1.8rem" }}
      title={org?.name || "Studio"}
    >
      {(org?.name || "S").charAt(0).toUpperCase()}
    </div>
  );

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="px-3 py-3 border-b">
        {multiOrg ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 w-full text-left rounded-md hover-elevate focus:outline-none">
                {orgLogo}
                <div className="flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold leading-snug truncate" style={{ fontSize: "0.85rem" }}>
                      {org?.name || "Studio"}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground" style={{ fontSize: "0.68rem" }}>Switch workspace</span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" className="w-56">
              {userOrgs.map(o => (
                <DropdownMenuItem
                  key={o.id}
                  onClick={() => { if (o.id !== orgId) switchOrgMutation.mutate(o.id); }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.id === orgId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2.5">
            {orgLogo}
            <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="font-extrabold leading-snug" style={{ fontSize: "0.85rem" }}>
                {org?.name || "Studio"}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: "0.68rem" }}>Interior Design</span>
            </div>
          </div>
        )}
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
              {renderMenuItems(visibleMainItems, navBadgeCounts)}
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
