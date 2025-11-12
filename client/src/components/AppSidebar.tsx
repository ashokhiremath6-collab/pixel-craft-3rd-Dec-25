import { Building2, Users, BarChart3, Settings, Home, FileText, Upload, Map, UserCheck, ImageIcon, PenTool, Sparkles, GanttChart, DollarSign, Wallet, BookOpen, Calendar, FileSignature } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
    title: "Works Orders",
    url: "/works-orders",
    icon: FileSignature,
  },
  {
    title: "Client Access",
    url: "/client-access",
    icon: UserCheck,
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

  // Close mobile sidebar when a link is clicked
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}