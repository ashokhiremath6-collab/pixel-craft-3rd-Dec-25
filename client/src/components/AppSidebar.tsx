import { Building2, Users, BarChart3, Settings, Home, FileText, Upload, Map, UserCheck, ImageIcon, PenTool, Sparkles, GanttChart, DollarSign, Wallet, BookOpen, Calendar, FileSignature, Wand2, Camera } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface NavigationItem {
  title: string;
  url: string;
  icon: typeof Home;
}

const mainItems: NavigationItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: Building2,
  },
  {
    title: "Project scheduling",
    url: "/gantt-chart",
    icon: GanttChart,
  },
  {
    title: "Floor Plans",
    url: "/floor-plans",
    icon: Map,
  },
  {
    title: "Moodboards",
    url: "/moodboards",
    icon: ImageIcon,
  },
  {
    title: "Renders",
    url: "/renders",
    icon: Sparkles,
  },
  {
    title: "Working Drawings",
    url: "/working-drawings",
    icon: PenTool,
  },
  {
    title: "Vendors by Category",
    url: "/vendors",
    icon: Users,
  },
  {
    title: "Comparative Quotes",
    url: "/quotes",
    icon: BarChart3,
  },
  {
    title: "Unit Rate Quotes",
    url: "/unit-rates",
    icon: DollarSign,
  },
  {
    title: "Import Quotes",
    url: "/import",
    icon: Upload,
  },
  {
    title: "Quote Templates",
    url: "/templates",
    icon: FileText,
  },
  {
    title: "Accounts",
    url: "/accounts",
    icon: Wallet,
  },
];

const settingsItems: NavigationItem[] = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

const designerOnlyItems: NavigationItem[] = [
  {
    title: "AI Renders",
    url: "/ai-renders",
    icon: Wand2,
  },
  {
    title: "Asset Ingestion",
    url: "/asset-ingestion",
    icon: Camera,
  },
  {
    title: "Catalogues",
    url: "/catalogue",
    icon: BookOpen,
  },
  {
    title: "Specifications",
    url: "/specifications",
    icon: FileText,
  },
  {
    title: "Meeting Minutes",
    url: "/meeting-minutes",
    icon: Calendar,
  },
  {
    title: "Client Access",
    url: "/client-access",
    icon: UserCheck,
  },
];

const projectManagerItems: NavigationItem[] = [
  {
    title: "Works Orders",
    url: "/works-orders",
    icon: FileSignature,
  },
  {
    title: "Meeting Minutes",
    url: "/meeting-minutes",
    icon: Calendar,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  
  // Get user info to check role
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  
  const canManageCatalogues = ['admin', 'designer'].includes((user as any)?.role);
  const canAccessWorksOrders = ['admin', 'designer', 'project_manager'].includes((user as any)?.role);

  // Close mobile sidebar when a link is clicked
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent className="pb-4">
        <SidebarGroup>
          <SidebarGroupLabel>PixelCraft Designer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canManageCatalogues && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {designerOnlyItems.map((item) => (
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
                ))}
                {/* Filter out items already in designerOnlyItems to avoid duplicates */}
                {projectManagerItems
                  .filter(item => !designerOnlyItems.some(d => d.url === item.url))
                  .map((item) => (
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
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!canManageCatalogues && canAccessWorksOrders && (
          <SidebarGroup>
            <SidebarGroupLabel>Project Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projectManagerItems.map((item) => (
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
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {settingsItems.map((item) => (
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
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}