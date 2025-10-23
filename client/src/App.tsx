import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/DashboardPage";
import VendorsPage from "@/pages/VendorsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import FloorPlansPage from "@/pages/FloorPlansPage";
import GanttChartPage from "@/pages/GanttChartPage";
import QuotesPage from "@/pages/QuotesPage";
import UnitRatesPage from "@/pages/UnitRatesPage";
import TemplatesPage from "@/pages/TemplatesPage";
import TemplateViewPage from "@/pages/TemplateViewPage";
import ImportPage from "@/pages/ImportPage";
import SettingsPage from "@/pages/SettingsPage";
import ClientAccessPage from "@/pages/ClientAccessPage";
import MoodboardsPage from "@/pages/MoodboardsPage";
import AccountsPage from "@/pages/AccountsPage";
import CataloguePage from "@/pages/CataloguePage";
import GanttLinksPage from "@/pages/GanttLinksPage";
import LoginPage from "@/pages/LoginPage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Shield, User, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/gantt-chart" component={GanttChartPage} />
      <Route path="/floor-plans" component={FloorPlansPage} />
      <Route path="/vendors" component={VendorsPage} />
      <Route path="/quotes" component={QuotesPage} />
      <Route path="/unit-rates" component={UnitRatesPage} />
      <Route path="/templates" component={TemplatesPage} />
      <Route path="/templates/:id" component={TemplateViewPage} />
      <Route path="/import" component={ImportPage} />
      <Route path="/gantt-links" component={GanttLinksPage} />
      <Route path="/accounts" component={AccountsPage} />
      <Route path="/catalogue" component={CataloguePage} />
      <Route path="/moodboards" component={MoodboardsPage} />
      <Route path="/working-drawings" component={MoodboardsPage} />
      <Route path="/renders" component={MoodboardsPage} />
      <Route path="/client-access" component={ClientAccessPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { logout, user } = useAuth();

  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-lg font-semibold" data-testid="heading-app-title">
                PixelCraft Designer
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={
                      user.role === 'admin' ? 'destructive' : 
                      user.role === 'designer' ? 'default' : 
                      'secondary'
                    }
                    className="capitalize flex items-center gap-1 px-2 py-1"
                    data-testid="badge-user-role"
                  >
                    {user.role === 'admin' && <Crown className="h-3 w-3" />}
                    {user.role === 'designer' && <Shield className="h-3 w-3" />}
                    {user.role === 'client' && <User className="h-3 w-3" />}
                    {user.role}
                  </Badge>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                data-testid="button-logout"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 bg-background">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Checking authentication status</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <AuthenticatedApp />;
  } else {
    return <LoginPage onLoginSuccess={() => {}} />;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
