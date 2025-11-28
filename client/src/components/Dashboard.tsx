import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import VendorCard from "./VendorCard";
import ProjectCard from "./ProjectCard";
import { Users, Building2, FileText, TrendingUp, Plus, ArrowRight, Clock, X, Download } from "lucide-react";
import type { Vendor, Project } from "@shared/schema";
import { formatCurrencyCompact, formatVendorNameWithProjectAndCategory } from "@/lib/currencyUtils";
import { format } from "date-fns";

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
    category?: string;
    quotationName?: string;
    quotationType?: string;
    uploaderName?: string | null;
    uploadedAt?: string | null;
  }>;
  allQuotations?: Array<{
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
  }>;
  onNavigate?: (path: string) => void;
}

export default function Dashboard({ vendors, projects, recentQuotations, allQuotations, onNavigate }: DashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isQuotationDetailModalOpen, setIsQuotationDetailModalOpen] = useState(false);

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

  const selectedQuotations = (allQuotations || recentQuotations)
    .filter(quote => quote.status === "Selected"); // Only include approved quotations

  const totalQuotationValue = selectedQuotations
    .reduce(
      (sum, quote) => sum + parseFloat(quote.quotationValue || '0'),
      0
    );

  const selectedVendors = selectedQuotations.length;

  const recentVendors = vendors.slice(0, 3);
  const recentProjects = projects.slice(0, 3);

  const formatCurrency = (value: number) => {
    return formatCurrencyCompact(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="heading-dashboard">
          PixelCraft Designer Dashboard
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

        <Card className="hover-elevate cursor-pointer" onClick={() => setIsQuotationDetailModalOpen(true)} data-testid="card-total-quotations">
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
                    <div className="font-medium">
                      {formatVendorNameWithProjectAndCategory(quotation.vendorName, quotation.projectName, quotation.category)}
                      {quotation.quotationName && quotation.quotationName !== "Main Quote" && (
                        <span className="text-sm text-muted-foreground ml-1">
                          - {quotation.quotationName}
                        </span>
                      )}
                      {quotation.quotationType === "option" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-2">
                          Option
                        </span>
                      )}
                      {quotation.uploaderName && (
                        <span className="text-sm text-red-600 dark:text-red-400 ml-2" data-testid={`uploader-${quotation.id}`}>
                          new - {quotation.uploaderName}
                        </span>
                      )}
                    </div>
                    {quotation.uploadedAt && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span data-testid={`text-uploaded-time-${quotation.id}`}>
                          {format(new Date(quotation.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                    )}
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

      {/* Quotation Breakdown Modal */}
      <Dialog open={isQuotationDetailModalOpen} onOpenChange={setIsQuotationDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>Project Cost Breakdown</DialogTitle>
            {selectedQuotations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Export to CSV
                  const headers = ['Vendor', 'Project', 'Category', 'Value (Lacs)'];
                  const rows = selectedQuotations.map(q => [
                    q.vendorName,
                    q.projectName,
                    q.category || '-',
                    (parseFloat(q.quotationValue || '0') / 100000).toFixed(2)
                  ]);
                  
                  // Add total row
                  rows.push(['', '', 'TOTAL', (totalQuotationValue / 100000).toFixed(2)]);
                  
                  const csvContent = [
                    headers.join(','),
                    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                  ].join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `Project_Cost_Breakdown_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
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
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px] font-semibold">Vendor</TableHead>
                        <TableHead className="w-[140px] font-semibold">Project</TableHead>
                        <TableHead className="w-[140px] font-semibold">Category</TableHead>
                        <TableHead className="w-[100px] text-right font-semibold">Rs lacs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuotations.map((quotation) => (
                        <TableRow key={quotation.id} data-testid={`quotation-line-${quotation.id}`} className="hover:bg-muted/30">
                          <TableCell className="font-medium py-3">{quotation.vendorName}</TableCell>
                          <TableCell className="py-3">{quotation.projectName}</TableCell>
                          <TableCell className="py-3 text-muted-foreground">{quotation.category || '-'}</TableCell>
                          <TableCell className="text-right py-3 font-mono font-semibold tabular-nums">
                            {(parseFloat(quotation.quotationValue || '0') / 100000).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Total Row */}
                <div className="border-t-2 border-primary/20 pt-4 bg-muted/30 -mx-6 px-6 pb-2 rounded-b-lg">
                  <div className="flex items-center justify-between font-semibold text-lg">
                    <span>Total Project Cost</span>
                    <span className="font-mono text-xl tabular-nums" data-testid="modal-total-quotations">
                      {(totalQuotationValue / 100000).toFixed(2)} lacs
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedQuotations.length} vendor{selectedQuotations.length !== 1 ? 's' : ''} selected
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