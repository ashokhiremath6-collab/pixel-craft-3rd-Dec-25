import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "./StatusBadge";
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from "lucide-react";
import type { Project } from "@shared/schema";

interface QuotationData {
  id: string;
  vendorName: string;
  category: string;
  quotationValue: string;
  dateOfQuotation: string;
  status: "Quoted" | "Selected" | "Rejected";
  quotationFile?: string;
  notes?: string;
  isAboveAverage?: boolean;
}

interface ComparativeQuotesProps {
  projects: Project[];
  quotations: Record<string, QuotationData[]>; // projectId -> quotations
  onStatusChange?: (quotationId: string, status: "Quoted" | "Selected" | "Rejected") => void;
}

export default function ComparativeQuotes({ projects, quotations, onStatusChange }: ComparativeQuotesProps) {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const handleProjectFilter = (projectId: string) => {
    setSelectedProject(projectId);
    console.log('Filter by project:', projectId);
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    console.log('Filter by category:', category);
  };

  // Get all quotations
  const allQuotations = Object.entries(quotations).flatMap(([projectId, quots]) =>
    quots.map(q => ({
      ...q,
      projectId,
      projectName: projects.find(p => p.id === projectId)?.projectName || 'Unknown'
    }))
  );

  // Get unique categories from quotations
  const categories = Array.from(new Set(allQuotations.map(q => q.category)));

  // Filter quotations
  const filteredQuotations = allQuotations.filter(quotation => {
    const matchesProject = selectedProject === "all" || quotation.projectId === selectedProject;
    const matchesCategory = selectedCategory === "all" || quotation.category === selectedCategory;
    return matchesProject && matchesCategory;
  });

  // Group by category and project
  const groupedData = filteredQuotations.reduce((acc, quotation) => {
    const key = `${quotation.category}-${quotation.projectId}`;
    if (!acc[key]) {
      acc[key] = {
        category: quotation.category,
        projectName: quotation.projectName,
        projectId: quotation.projectId,
        quotations: []
      };
    }
    acc[key].quotations.push(quotation);
    return acc;
  }, {} as Record<string, {
    category: string;
    projectName: string;
    projectId: string;
    quotations: typeof filteredQuotations;
  }>);

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value));
  };

  const getAverageQuote = (categoryQuotations: typeof filteredQuotations) => {
    if (categoryQuotations.length === 0) return 0;
    const sum = categoryQuotations.reduce((acc, q) => acc + parseFloat(q.quotationValue), 0);
    return sum / categoryQuotations.length;
  };

  const getQuoteVariance = (value: string, average: number) => {
    const quotationValue = parseFloat(value);
    return ((quotationValue - average) / average) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-comparative-quotes">
            Comparative Quotes
          </h1>
          <p className="text-muted-foreground">
            Compare vendor quotations side-by-side by project and category
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {Object.keys(groupedData).length} comparison groups
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Project</label>
              <Select value={selectedProject} onValueChange={handleProjectFilter}>
                <SelectTrigger data-testid="select-project-filter">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Groups */}
      {Object.entries(groupedData).map(([key, group]) => {
        const average = getAverageQuote(group.quotations);
        const sortedQuotations = [...group.quotations].sort((a, b) => 
          parseFloat(a.quotationValue) - parseFloat(b.quotationValue)
        );

        return (
          <Card key={key} className="" data-testid={`comparison-group-${key}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {group.category} - {group.projectName}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span data-testid="text-quote-count">
                      {group.quotations.length} quotes
                    </span>
                    <span data-testid="text-average-quote">
                      Average: {formatCurrency(average.toString())}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" data-testid="badge-category">
                  {group.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Quote Value</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQuotations.map((quotation, index) => {
                    const variance = getQuoteVariance(quotation.quotationValue, average);
                    const isLowest = index === 0;
                    const isHighest = index === sortedQuotations.length - 1;
                    
                    return (
                      <TableRow 
                        key={quotation.id}
                        className={quotation.status === "Selected" ? "bg-green-50 dark:bg-green-900/10" : ""}
                        data-testid={`quotation-row-${quotation.id}`}
                      >
                        <TableCell className="font-medium" data-testid="text-vendor-name">
                          {quotation.vendorName}
                        </TableCell>
                        
                        <TableCell data-testid="text-quotation-value">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">
                              {formatCurrency(quotation.quotationValue)}
                            </span>
                            {isLowest && (
                              <Badge variant="outline" className="text-green-600 border-green-200">
                                Lowest
                              </Badge>
                            )}
                            {quotation.isAboveAverage && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell data-testid="text-variance">
                          <div className="flex items-center gap-1">
                            {variance > 0 ? (
                              <TrendingUp className="h-4 w-4 text-red-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-green-500" />
                            )}
                            <span className={variance > 0 ? "text-red-600" : "text-green-600"}>
                              {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell data-testid="text-quotation-date">
                          {new Date(quotation.dateOfQuotation).toLocaleDateString()}
                        </TableCell>
                        
                        <TableCell data-testid="cell-status">
                          <StatusBadge status={quotation.status} />
                        </TableCell>
                        
                        <TableCell data-testid="cell-actions">
                          <div className="flex gap-1">
                            {quotation.status !== "Selected" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onStatusChange?.(quotation.id, "Selected")}
                                data-testid="button-select-vendor"
                              >
                                Select
                              </Button>
                            )}
                            {quotation.status === "Quoted" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onStatusChange?.(quotation.id, "Rejected")}
                                data-testid="button-reject-vendor"
                              >
                                Reject
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {Object.keys(groupedData).length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-comparisons">
              No quotations available for comparison with the selected filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}