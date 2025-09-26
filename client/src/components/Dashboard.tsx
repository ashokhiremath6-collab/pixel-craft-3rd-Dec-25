import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VendorCard from "./VendorCard";
import ProjectCard from "./ProjectCard";
import { Users, Building2, FileText, TrendingUp, Plus, ArrowRight } from "lucide-react";
import type { Vendor, Project } from "@shared/schema";

interface VendorWithCategory extends Omit<Vendor, 'categoryName'> {
  category: string;
}

interface DashboardProps {
  vendors: VendorWithCategory[];
  projects: Project[];
  recentQuotations: Array<{
    id: string;
    vendorName: string;
    projectName: string;
    quotationValue: string;
    status: "Quoted" | "Selected" | "Rejected";
    dateOfQuotation: string;
  }>;
  onNavigate?: (path: string) => void;
}

export default function Dashboard({ vendors, projects, recentQuotations, onNavigate }: DashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleNavigate = (path: string) => {
    console.log('Navigate to:', path);
    onNavigate?.(path);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    console.log('Category selected:', category);
  };

  // Calculate statistics
  const vendorsByCategory = vendors.reduce((acc, vendor) => {
    acc[vendor.category] = (acc[vendor.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeProjects = projects.filter(project => 
    !project.endDate || new Date(project.endDate) > new Date()
  ).length;

  const totalQuotationValue = recentQuotations.reduce(
    (sum, quote) => sum + parseFloat(quote.quotationValue),
    0
  );

  const selectedVendors = recentQuotations.filter(q => q.status === "Selected").length;

  const recentVendors = vendors.slice(0, 3);
  const recentProjects = projects.slice(0, 3);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      notation: 'compact'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="heading-dashboard">
          Vendor Management Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of your vendors, projects, and quotations
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover-elevate cursor-pointer" onClick={() => handleNavigate('/vendors')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-vendors">
              {vendors.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {Object.keys(vendorsByCategory).length} categories
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => handleNavigate('/projects')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-projects">
              {activeProjects}
            </div>
            <p className="text-xs text-muted-foreground">
              {projects.length - activeProjects} completed
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => handleNavigate('/quotes')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quotations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-quotations">
              {formatCurrency(totalQuotationValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedVendors} vendors selected
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-success-rate">
              {recentQuotations.length > 0 
                ? Math.round((selectedVendors / recentQuotations.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Vendor selection rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vendors by Category</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleNavigate('/vendors')}
            data-testid="button-view-all-vendors"
          >
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(vendorsByCategory).map(([category, count]) => (
              <div
                key={category}
                className={`p-4 rounded-lg border hover-elevate cursor-pointer transition-colors ${
                  selectedCategory === category ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => handleCategoryClick(category)}
                data-testid={`category-card-${category}`}
              >
                <div className="text-lg font-semibold">{count}</div>
                <div className="text-sm text-muted-foreground">{category}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Vendors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Vendors</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleNavigate('/vendors')}
              data-testid="button-view-all-vendors-recent"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Vendor
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentVendors.length > 0 ? (
              recentVendors.map(vendor => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground" data-testid="text-no-recent-vendors">
                  No vendors added yet
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => handleNavigate('/vendors')}
                  className="mt-2"
                  data-testid="button-add-first-vendor"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Vendor
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Projects</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleNavigate('/projects')}
              data-testid="button-view-all-projects"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Project
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentProjects.length > 0 ? (
              recentProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground" data-testid="text-no-recent-projects">
                  No projects added yet
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => handleNavigate('/projects')}
                  className="mt-2"
                  data-testid="button-add-first-project"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Project
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotations */}
      {recentQuotations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Quotations</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleNavigate('/quotes')}
              data-testid="button-view-all-quotes"
            >
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentQuotations.slice(0, 5).map(quotation => (
                <div 
                  key={quotation.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                  data-testid={`recent-quotation-${quotation.id}`}
                >
                  <div className="flex-1">
                    <div className="font-medium">{quotation.vendorName}</div>
                    <div className="text-sm text-muted-foreground">
                      {quotation.projectName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">
                      {formatCurrency(parseFloat(quotation.quotationValue))}
                    </div>
                    <Badge 
                      variant={quotation.status === "Selected" ? "default" : "secondary"}
                      className="mt-1"
                    >
                      {quotation.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}