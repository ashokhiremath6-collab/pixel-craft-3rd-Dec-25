import { Building2, Users, BarChart3, Settings, Home, FileText, Upload, Map, UserCheck, ImageIcon, PenTool, Sparkles, GanttChart, DollarSign, Wallet, BookOpen, Calendar, FileSignature, Wand2, Camera, BrainCircuit, User, Receipt } from "lucide-react";
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
  { title: "Meeting Minutes", url: "/meeting-minutes", icon: Calendar },
];

// Reduced nav for project managers — only what pertains to their role
const projectManagerMainItems: NavigationItem[] = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Projects", url: "/projects", icon: Building2 },
  { title: "Project scheduling", url: "/gantt-chart", icon: GanttChart },
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

export function AppSidebar() {
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuth();

  const role = (user as any)?.role as string | undefined;
  const isAdminOrDesigner = role === 'admin' || role === 'designer';
  const isProjectManager = role === 'project_manager';

  // Choose which main items to show based on role
  const visibleMainItems = isProjectManager ? projectManagerMainItems : mainItems;

  // Close mobile sidebar when a link is clicked
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderMenuItems = (items: NavigationItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          data-active={location === item.url}
          data-testid={`sidebar-link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Link href={item.url} onClick={handleLinkClick}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="px-3 py-3 border-b">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Olympik Design" className="h-7 w-7 object-contain shrink-0" />
          <span className="font-semibold text-xs leading-tight">Olympik Design</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="pb-4">
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(visibleMainItems)}
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
