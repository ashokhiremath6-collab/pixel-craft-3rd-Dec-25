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
import QuotesPage from "@/pages/QuotesPage";
import TemplatesPage from "@/pages/TemplatesPage";
import TemplateViewPage from "@/pages/TemplateViewPage";
import ImportPage from "@/pages/ImportPage";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import { useState } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/floor-plans" component={FloorPlansPage} />
      <Route path="/vendors" component={VendorsPage} />
      <Route path="/quotes" component={QuotesPage} />
      <Route path="/templates" component={TemplatesPage} />
      <Route path="/templates/:id" component={TemplateViewPage} />
      <Route path="/import" component={ImportPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
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
                Vendor Management
              </h1>
            </div>
            <ThemeToggle />
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check authentication status
  const { data: authStatus, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      return response.ok;
    },
    retry: false,
    refetchOnWindowFocus: false
  });

  // If we get a successful auth check, user is authenticated
  if (authStatus && !isAuthenticated) {
    setIsAuthenticated(true);
  }

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // Invalidate auth query to refetch user data
    queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
  };

  if (isAuthenticated || authStatus) {
    return <AuthenticatedApp />;
  } else {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
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
