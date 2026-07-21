import { useState, useEffect } from "react";
import { sortProjectsForDropdown } from "@/lib/projectSort";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import StatusBadge from "./StatusBadge";
import QuoteDetailModal from "./QuoteDetailModal";
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, ChevronRight, ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Eye, Trash2, Edit2, Paperclip, Building2, Check, Search, X, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileViewerModal } from "@/components/FileViewerModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, VendorCategory } from "@shared/schema";
import { formatCurrencyCompact, formatVendorNameWithCategory } from "@/lib/currencyUtils";
import { format } from "date-fns";
import { RecentBadge } from "@/components/RecentBadge";

interface QuotationData {
  id: string;
  vendorName: string;
  category: string;
  quotationName: string; // "Main Quote", "Option A", "Kitchen Cabinets", etc.
  quotationType: "item" | "option"; // Type of quotation
  parentQuotationId?: string | null; // For grouping options under main items
  itemCategory?: string | null; // For organizing different items in folders
  quotationValue: string | null | undefined;
  gstPercent?: string | null; // GST percentage applied on top of quotationValue
  dateOfQuotation: string | null | undefined;
  status: "Quoted" | "Selected" | "Rejected";
  quotationFile?: string;
  notes?: string;
  isAboveAverage?: boolean;
  isNegotiated?: boolean; // Mark as final negotiated quote
  unitRateSubtype?: string | null; // "quote" or "comparative" for unit rate quotes
  uploaderName?: string | null; // Who uploaded the file
  uploadedAt?: string | null; // When the file was uploaded
  portalSubmittedAt?: string | null; // Set when vendor submitted this via the portal
  quoteFileId?: string | null; // Set when this row represents a specific portal-uploaded file
}

interface CategoryWithChildren extends VendorCategory {
  children: CategoryWithChildren[];
  level: number;
}

interface ComparativeQuotesProps {
  projects: Project[];
  categories: VendorCategory[];
  quotations: Record<string, QuotationData[]>; // projectId -> quotations
  onStatusChange?: (quotationId: string, status: "Quoted" | "Selected" | "Rejected") => void;
  hideValueColumns?: boolean; // Hide quote value and variance columns
  initialProject?: string;
  initialCategory?: string;
  initialQuoteId?: string; // projectVendorId — auto-opens the file viewer for this quote
}

// ── Per-vendor scope grouping ─────────────────────────────────────────────────
// Groups a vendor's quotes by quotationName. Multiple quotes with the same name
// are treated as revisions (newest first). Different names = different items.
function groupVendorByScopeName(vendorQuotations: QuotationData[]): Array<{
  scopeName: string;
  quotes: QuotationData[];
  currentQuote: QuotationData;
  isRevised: boolean;
}> {
  const byScope = new Map<string, QuotationData[]>();
  for (const q of vendorQuotations) {
    const name = q.quotationName || "Main Quote";
    if (!byScope.has(name)) byScope.set(name, []);
    byScope.get(name)!.push(q);
  }
  return Array.from(byScope.entries()).map(([scopeName, quotes]) => {
    const sorted = [...quotes].sort((a, b) => {
      const aDate = a.uploadedAt || a.dateOfQuotation || "";
      const bDate = b.uploadedAt || b.dateOfQuotation || "";
      return bDate.localeCompare(aDate); // newest first
    });
    // Selected quote takes priority as "current"; otherwise the newest
    const selected = sorted.find(q => q.status === "Selected");
    const currentQuote = selected ?? sorted[0];
    return { scopeName, quotes: sorted, currentQuote, isRevised: sorted.length > 1 };
  });
}

function QuoteGroupSection({ label, count, children, open, onOpenChange }: { label: string; count: number; children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button type="button" className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover-elevate rounded-md text-left">
          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <span className="font-medium">{label}</span>
          <Badge variant="secondary" className="no-default-active-elevate">
            {count} vendor{count !== 1 ? 's' : ''}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 mb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ComparativeQuotes({ projects, categories, quotations, onStatusChange, hideValueColumns = false, initialProject, initialCategory, initialQuoteId }: ComparativeQuotesProps) {
  const [selectedProject, setSelectedProject] = useState<string>(initialProject ?? "");

  // Auto-select the first project alphabetically when projects load
  useEffect(() => {
    if (projects.length > 0 && !selectedProject && !initialProject) {
      const sorted = sortProjectsForDropdown(projects);
      if (sorted.length > 0) setSelectedProject(sorted[0].id);
    }
  }, [projects, selectedProject, initialProject]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory ?? "all");
  const [vendorSearch, setVendorSearch] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [highlightedQuoteId, setHighlightedQuoteId] = useState<string | null>(initialQuoteId ?? null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ vendorName: string; projectName: string } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuotationData | null>(null);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerUrl, setFileViewerUrl] = useState("");
  const [fileViewerName, setFileViewerName] = useState("");
  const [editFormData, setEditFormData] = useState({
    quotationName: "",
    quotationValue: "",
    gstPercent: "",
    dateOfQuotation: "",
    notes: "",
    isNegotiated: false
  });
  const [isExtractingAmount, setIsExtractingAmount] = useState(false);
  const { toast } = useToast();

  const handleAutoExtractAmount = async () => {
    if (!editingQuote) return;
    const hasFile = editingQuote.quotationFile || editingQuote.quoteFileId;
    if (!hasFile) {
      toast({ title: "No PDF attached", description: "This quote doesn't have an attached file to read from.", variant: "destructive" });
      return;
    }
    setIsExtractingAmount(true);
    try {
      const res = await apiRequest("POST", "/api/quotes/extract-amount", {
        projectVendorId: editingQuote.id,
        quoteFileId: editingQuote.quoteFileId || null,
      });
      const data = await res.json();
      if (data.baseAmount != null) {
        const updates: Partial<typeof editFormData> = { quotationValue: String(data.baseAmount) };
        if (data.gstPercent != null && data.gstPercent > 0) {
          updates.gstPercent = String(data.gstPercent);
        }
        setEditFormData(prev => ({ ...prev, ...updates }));
        const gstNote = data.gstPercent ? ` at ${data.gstPercent}% GST` : "";
        toast({ title: "Values extracted from PDF", description: `Base amount ₹${data.baseAmount.toLocaleString('en-IN')}${gstNote}.` });
      } else {
        toast({ title: "Could not extract amount", description: "The AI couldn't find a clear subtotal in this document. Please enter the values manually.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Extraction failed", description: "Failed to read the PDF. Please enter the values manually.", variant: "destructive" });
    } finally {
      setIsExtractingAmount(false);
    }
  };

  const handleProjectFilter = (projectId: string) => {
    setSelectedProject(projectId);
    console.log('Filter by project:', projectId);
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    console.log('Filter by category:', category);
  };

  const handleQuoteClick = (quotation: QuotationData, projectName: string) => {
    setSelectedQuoteId(quotation.id);
    setModalData({
      vendorName: quotation.vendorName,
      projectName: projectName
    });
    setIsModalOpen(true);
  };

  // Open the group containing the target quote, then scroll to it
  useEffect(() => {
    if (!initialQuoteId || Object.keys(quotations).length === 0) return;
    // Find which group key contains this quote
    const allFlat = Object.entries(quotations).flatMap(([pid, qs]) =>
      qs.map((q: any) => ({ ...q, projectId: pid }))
    );
    const target = allFlat.find((q: any) => q.id === initialQuoteId);
    if (target) {
      const groupKey = `${target.category}-${target.projectId}`;
      setOpenGroups(prev => {
        const next = new Set(prev);
        next.add(groupKey);
        return next;
      });
    }
    // Scroll after the collapsible has had time to open and render
    const timer = setTimeout(() => {
      const row = document.querySelector(`[data-testid="quotation-row-${initialQuoteId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [initialQuoteId, quotations]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedQuoteId(null);
    setModalData(null);
  };

  const handleViewFile = (quotation: QuotationData) => {
    if (!quotation.quotationFile) return;
    const fileName = quotation.quotationFile.split('/').pop() || `${quotation.vendorName}_quote`;
    setFileViewerUrl(quotation.quotationFile);
    setFileViewerName(fileName);
    setFileViewerOpen(true);
  };

  const handleDownloadFile = (quotation: QuotationData) => {
    if (!quotation.quotationFile) return;
    const link = document.createElement('a');
    link.href = quotation.quotationFile;
    link.download = quotation.quotationFile.split('/').pop() || `${quotation.vendorName}_quote`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditQuote = (quotation: QuotationData) => {
    setEditingQuote(quotation);
    setEditFormData({
      quotationName: quotation.quotationName || "Main Quote",
      quotationValue: quotation.quotationValue || "",
      gstPercent: quotation.gstPercent || "",
      dateOfQuotation: quotation.dateOfQuotation || "",
      notes: quotation.notes || "",
      isNegotiated: quotation.isNegotiated || false
    });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingQuote(null);
    setEditFormData({ quotationName: "", quotationValue: "", gstPercent: "", dateOfQuotation: "", notes: "", isNegotiated: false });
  };

  // Update quote mutation — routes to per-file endpoint when quoteFileId is set
  const updateQuoteMutation = useMutation({
    mutationFn: async (data: { quoteId: string; quoteFileId?: string | null; updates: any }) => {
      if (data.quoteFileId) {
        // Per-file row: update the file's own quoted_amount and display_name
        const fileUpdates: any = {
          quotedAmount: data.updates.quotationValue || null,
          displayName: data.updates.quotationName || null,
        };
        const response = await apiRequest('PATCH', `/api/quote-files/${data.quoteFileId}`, fileUpdates);
        // Also update pv-level fields (notes, isNegotiated, dateOfQuotation, gstPercent) on the parent PV
        const pvUpdates = {
          notes: data.updates.notes || null,
          dateOfQuotation: data.updates.dateOfQuotation || null,
          isNegotiated: data.updates.isNegotiated,
          gstPercent: data.updates.gstPercent || null,
        };
        await apiRequest('PUT', `/api/project-vendors/${data.quoteId}`, pvUpdates);
        return response.json();
      } else {
        const response = await apiRequest('PUT', `/api/project-vendors/${data.quoteId}`, data.updates);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors-with-projects'] });
      handleCloseEditModal();
      toast({
        title: "Success",
        description: "Quote updated successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to update quote:', error);
      toast({
        title: "Error",
        description: "Failed to update quote. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSaveEdit = () => {
    if (!editingQuote) return;
    
    updateQuoteMutation.mutate({
      quoteId: editingQuote.id,
      quoteFileId: editingQuote.quoteFileId,
      updates: {
        quotationName: editFormData.quotationName || "Main Quote",
        quotationValue: editFormData.quotationValue || null,
        gstPercent: editFormData.gstPercent || null,
        dateOfQuotation: editFormData.dateOfQuotation || null,
        notes: editFormData.notes || null,
        isNegotiated: editFormData.isNegotiated
      }
    });
  };

  // Handle quote deletion
  const handleDeleteQuote = async (quotationId: string, vendorName: string) => {
    try {
      await apiRequest('DELETE', `/api/project-vendors/${quotationId}`);
      
      // Invalidate the quotations cache to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/quotations'] });
      
      toast({
        title: "Quote deleted",
        description: `Quote from ${vendorName} has been deleted successfully.`,
      });
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle individual quote export
  const handleIndividualQuoteExport = async (quotation: QuotationData, group: any, format: 'csv' | 'excel' | 'pdf') => {
    try {
      setIsExporting(true);

      // Create export data for individual quote
      const exportData = {
        quotation: {
          id: quotation.id,
          vendorName: quotation.vendorName,
          category: quotation.category,
          quotationValue: quotation.quotationValue || '',
          dateOfQuotation: quotation.dateOfQuotation || '',
          status: quotation.status,
          quotationFile: quotation.quotationFile || '',
          notes: quotation.notes || '',
          projectName: group.projectName,
          projectId: group.projectId
        },
        metadata: {
          exportDate: new Date().toISOString(),
          exportType: 'individual_quote'
        }
      };

      const response = await fetch(`/api/quotes/export/individual/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to export quote as ${format.toUpperCase()}`);
      }

      // Get filename from response headers or create default
      const contentDisposition = response.headers.get('Content-Disposition');
      const getFileExtension = () => {
        switch (format) {
          case 'excel': return 'xlsx';
          case 'pdf': return 'pdf';
          case 'csv': 
          default: return 'csv';
        }
      };
      const filename = contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] || 
        `quote_${quotation.vendorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${getFileExtension()}`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Quote Exported Successfully",
        description: `Individual quote from ${quotation.vendorName} exported as ${format.toUpperCase()}`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export quote",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Get all quotations
  const allQuotations = Object.entries(quotations).flatMap(([projectId, quots]) =>
    quots.map(q => ({
      ...q,
      projectId,
      projectName: projects.find(p => p.id === projectId)?.projectName || 'Unknown'
    }))
  );

  // Helper function to build category tree structure
  const buildCategoryTree = (categories: VendorCategory[]): CategoryWithChildren[] => {
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // First pass: create all categories with children arrays
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [], level: 0 });
    });

    // Second pass: organize into tree structure and set levels
    categories.forEach(cat => {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          categoryWithChildren.level = parent.level + 1;
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  };

  // Helper function to flatten tree for easy lookup
  const flattenCategoryTree = (tree: CategoryWithChildren[]): CategoryWithChildren[] => {
    const result: CategoryWithChildren[] = [];
    
    const traverse = (nodes: CategoryWithChildren[]) => {
      nodes.forEach(node => {
        result.push(node);
        traverse(node.children);
      });
    };
    
    traverse(tree);
    return result;
  };

  // Build category tree and flatten for select options
  const categoryTree = buildCategoryTree(categories);
  const flatCategories = flattenCategoryTree(categoryTree);

  // Create a map of categoryId to category for easy lookup
  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  }, {} as Record<string, VendorCategory>);

  // Helper function to get all descendant category IDs
  const getCategoryWithDescendants = (categoryId: string): string[] => {
    const result = [categoryId];
    const category = flatCategories.find(cat => cat.id === categoryId);
    
    if (category) {
      const addDescendants = (cat: CategoryWithChildren) => {
        cat.children.forEach(child => {
          result.push(child.id);
          addDescendants(child);
        });
      };
      addDescendants(category);
    }
    
    return result;
  };

  // Filter quotations with hierarchical category support + vendor name search
  const filteredQuotations = allQuotations.filter(quotation => {
    const matchesProject = !selectedProject || quotation.projectId === selectedProject;
    
    // For hierarchical filtering, include quotations from selected category and all its descendants
    let matchesCategory = selectedCategory === "all";
    if (!matchesCategory && selectedCategory !== "all") {
      const categoryIds = getCategoryWithDescendants(selectedCategory);
      // Try to find a matching category by name (for backward compatibility with existing quotation data)
      const categoryNames = categoryIds.map(id => categoryMap[id]?.name).filter(Boolean);
      matchesCategory = categoryNames.includes(quotation.category);
    }

    const matchesVendor = !vendorSearch.trim() ||
      quotation.vendorName.toLowerCase().includes(vendorSearch.toLowerCase());
    
    return matchesProject && matchesCategory && matchesVendor;
  });

  // Separate regular quotes from comparative statements
  const regularQuotes = filteredQuotations.filter(q => q.unitRateSubtype !== 'comparative');
  const comparativeStatements = filteredQuotations.filter(q => q.unitRateSubtype === 'comparative');

  // Group regular quotes by category and project
  const groupedData = regularQuotes.reduce((acc, quotation) => {
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

  // Group comparative statements by category and project
  const groupedComparativeData = comparativeStatements.reduce((acc, quotation) => {
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
    // Check if this is a unit rates quote (marked with -1)
    if (value === '-1' || value === '-1.00') {
      return <span className="text-muted-foreground italic">unit rates</span>;
    }
    return formatCurrencyCompact(value);
  };

  const getLowestQuote = (categoryQuotations: typeof filteredQuotations) => {
    if (categoryQuotations.length === 0) return 0;
    // Only count the current (latest/selected) quote per vendor-scope pair.
    // Superseded revisions are excluded from the lowest-quote calculation.
    const byVendor: Record<string, typeof filteredQuotations> = {};
    for (const q of categoryQuotations) {
      if (!byVendor[q.vendorName]) byVendor[q.vendorName] = [];
      byVendor[q.vendorName].push(q);
    }
    const currentQuotes = Object.values(byVendor).flatMap(vqs =>
      groupVendorByScopeName(vqs).map(sg => sg.currentQuote)
    );
    const validQuotes = currentQuotes.filter(q => {
      const value = q.quotationValue ? parseFloat(q.quotationValue) : 0;
      return value > 0;
    });
    if (validQuotes.length === 0) return 0;
    return Math.min(...validQuotes.map(q => parseFloat(q.quotationValue!)));
  };

  const getQuoteVariance = (value: string | null | undefined, lowestQuote: number) => {
    if (!value || lowestQuote === 0) return 0;
    const quotationValue = parseFloat(value);
    if (isNaN(quotationValue) || quotationValue < 0) return 0; // Skip unit rates (-1)
    return ((quotationValue - lowestQuote) / lowestQuote) * 100;
  };

  // Export functions
  const handleExportCSV = () => {
    exportQuotes('csv');
  };

  const handleExportExcel = () => {
    exportQuotes('excel');
  };

  const exportQuotes = async (format: 'csv' | 'excel') => {
    if (isExporting) return; // Prevent multiple simultaneous exports
    
    setIsExporting(true);
    
    try {
      // Check if there's data to export
      if (filteredQuotations.length === 0) {
        toast({
          variant: "destructive",
          title: "No data to export",
          description: "Please adjust your filters to include quotations for export."
        });
        return;
      }

      const exportData = {
        filters: {
          project: selectedProject,
          category: selectedCategory
        },
        quotations: filteredQuotations,
        groupedData: Object.entries(groupedData).map(([key, group]) => ({
          key,
          category: group.category,
          projectName: group.projectName,
          projectId: group.projectId,
          quotations: group.quotations,
          lowestQuote: getLowestQuote(group.quotations)
        }))
      };

      // Call API endpoint for export
      const response = await fetch(`/api/quotes/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Export failed: ${response.statusText}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `quotes_export_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show success message
      toast({
        title: "Export successful",
        description: `${format.toUpperCase()} file downloaded successfully with ${filteredQuotations.length} quotations.`
      });

    } catch (error) {
      console.error('Export failed:', error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred during export."
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Shared table-body renderer ────────────────────────────────────────────────
  // Returns an array of <TableRow> nodes for the given category quotations.
  // Renders a vendor sub-header band, then per-scope rows. Within each scope,
  // the newest quote is "current" and older ones appear below as "Superseded".
  const renderQuoteTableBody = (
    categoryQuotations: typeof filteredQuotations,
    group: { projectName: string; category: string; projectId: string },
    isComparativeSection = false
  ): React.ReactNode[] => {
    const lowestQuote = getLowestQuote(categoryQuotations);
    const colCount = hideValueColumns ? 5 : 7;

    // Group by vendor (sorted alphabetically)
    const byVendor: Record<string, typeof filteredQuotations> = {};
    for (const q of categoryQuotations) {
      if (!byVendor[q.vendorName]) byVendor[q.vendorName] = [];
      byVendor[q.vendorName].push(q);
    }
    const sortedVendorEntries = Object.entries(byVendor).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    const rows: React.ReactNode[] = [];

    sortedVendorEntries.forEach(([vendorName, vendorQuotations]) => {
      const scopeGroups = groupVendorByScopeName(vendorQuotations);
      const hasRevisions = scopeGroups.some(sg => sg.isRevised);
      const isVendorSelected = vendorQuotations.some(q => q.status === "Selected");

      // ── Vendor sub-header band ──────────────────────────────────────────────
      rows.push(
        <TableRow key={`${vendorName}-${group.projectId}-hdr`} className="bg-muted/25 border-b border-muted">
          <TableCell colSpan={colCount} className="py-1.5 px-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className={`font-semibold text-sm ${isVendorSelected ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                {vendorName}
              </span>
              {isVendorSelected && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              {hasRevisions && (
                <Badge variant="outline" className="no-default-active-elevate text-xs text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                  Revised
                </Badge>
              )}
            </div>
          </TableCell>
        </TableRow>
      );

      // ── Scope groups ────────────────────────────────────────────────────────
      scopeGroups.forEach(({ scopeName, quotes, currentQuote, isRevised }) => {
        // quotes is newest-first; we render current first, then older revisions
        quotes.forEach((quotation, revIdx) => {
          const isCurrent = quotation.id === currentQuote.id;
          // Revision numbers: oldest = Rev 1, newest = Rev N
          const revNumber = quotes.length - revIdx;
          const quotationNumericValue = quotation.quotationValue ? parseFloat(quotation.quotationValue) : 0;
          const variance = isCurrent ? getQuoteVariance(quotation.quotationValue, lowestQuote) : 0;
          const isLowest = isCurrent && quotationNumericValue > 0 && quotationNumericValue === lowestQuote;
          const isSelected = quotation.status === "Selected";
          const isHighlighted = quotation.id === highlightedQuoteId;

          rows.push(
            <TableRow
              key={quotation.id}
              className={`h-10 border-l-4 ${
                isHighlighted
                  ? "bg-amber-50 dark:bg-amber-900/25 border-l-amber-400"
                  : isSelected
                  ? "bg-emerald-50 dark:bg-emerald-900/25 border-l-emerald-500"
                  : "border-l-transparent"
              }${!isCurrent ? " opacity-60" : ""}`}
              data-testid={`quotation-row-${quotation.id}`}
              onClick={() => isHighlighted && setHighlightedQuoteId(null)}
            >
              {/* Name / scope cell */}
              <TableCell className="py-2 pl-7 pr-2 font-medium text-sm" data-testid="text-vendor-name">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {!isCurrent && <span className="text-muted-foreground text-xs">└</span>}
                  <span className={!isCurrent ? "text-muted-foreground text-xs" : ""}>
                    {!isCurrent
                      ? `Rev ${revNumber}${quotation.uploadedAt ? ` · ${format(new Date(quotation.uploadedAt), "d MMM yyyy")}` : ""}`
                      : isComparativeSection
                      ? "Unit rate comparative statement"
                      : scopeName}
                  </span>
                  {isCurrent && isRevised && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Current
                    </span>
                  )}
                  {quotation.quotationType === "option" && isCurrent && (
                    <Badge variant="outline" className="text-xs px-1 py-0">Option</Badge>
                  )}
                  {quotation.portalSubmittedAt && isCurrent && (
                    <Badge className="text-xs px-1 py-0 no-default-active-elevate" style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #c4b5fd" }}>
                      Via Portal
                    </Badge>
                  )}
                </div>
                {isCurrent && isRevised && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {quotes.length} revision{quotes.length !== 1 ? "s" : ""}
                  </div>
                )}
              </TableCell>

              {/* Value & variance */}
              {!hideValueColumns && (
                <>
                  <TableCell className="py-2" data-testid="text-quotation-value">
                    {isCurrent ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-mono font-semibold text-sm">
                          {quotationNumericValue > 0
                            ? formatCurrency(quotation.quotationValue!)
                            : <span className="text-muted-foreground">No total</span>}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {isLowest && <Badge variant="outline" className="text-xs text-green-600 border-green-200 px-1">Lowest</Badge>}
                          {quotation.isNegotiated && <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 px-1">Negotiated</Badge>}
                          {quotation.isAboveAverage && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">
                        {quotationNumericValue > 0 ? formatCurrencyCompact(quotation.quotationValue!) : "—"}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="py-2" data-testid="text-variance">
                    {isCurrent ? (
                      <div className="flex items-center gap-1">
                        {variance === 0
                          ? <span className="text-xs text-green-600 font-medium">0.0%</span>
                          : <><TrendingUp className="h-3 w-3 text-red-500" /><span className="text-xs text-red-600">+{variance.toFixed(1)}%</span></>}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </>
              )}

              {/* Quote date */}
              <TableCell className="py-2 text-xs" data-testid="text-quotation-date">
                {quotation.dateOfQuotation
                  ? new Date(quotation.dateOfQuotation).toLocaleDateString()
                  : <span className="text-muted-foreground">No date</span>}
              </TableCell>

              {/* Uploaded */}
              <TableCell className="py-2 text-xs" data-testid="text-uploaded-at">
                {quotation.uploadedAt && isCurrent ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{format(new Date(quotation.uploadedAt), "MMM d, yyyy")}</span>
                      <RecentBadge date={quotation.uploadedAt} />
                    </div>
                    <span className="text-muted-foreground">{format(new Date(quotation.uploadedAt), "h:mm a")}</span>
                    {quotation.uploaderName && <span className="text-muted-foreground">By {quotation.uploaderName}</span>}
                  </div>
                ) : <span className="text-muted-foreground">-</span>}
              </TableCell>

              {/* Status */}
              <TableCell className="py-2" data-testid="cell-status">
                {!isCurrent
                  ? <span className="text-xs text-muted-foreground italic">Superseded</span>
                  : <StatusBadge status={quotation.status} />}
              </TableCell>

              {/* Actions */}
              <TableCell className="py-2" data-testid="cell-actions">
                <div className="flex gap-0.5">
                  {isCurrent ? (
                    <>
                      <Button size="icon" className="h-6 w-6" variant="ghost"
                        onClick={() => handleQuoteClick(quotation, group.projectName)}
                        data-testid={`button-view-quote-${quotation.id}`} title="View detailed quote breakdown">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="icon" className="h-6 w-6" variant="ghost"
                        onClick={() => handleEditQuote(quotation)}
                        data-testid={`button-edit-quote-${quotation.id}`} title="Edit quote values">
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      {quotation.status === "Quoted" && (
                        <>
                          <Button size="sm" className="h-6 text-xs px-2" variant="outline"
                            onClick={() => onStatusChange?.(quotation.id, "Selected")} data-testid="button-select-vendor">
                            Select
                          </Button>
                          <Button size="sm" className="h-6 text-xs px-2" variant="outline"
                            onClick={() => onStatusChange?.(quotation.id, "Rejected")} data-testid="button-reject-vendor">
                            Reject
                          </Button>
                        </>
                      )}
                      {quotation.status === "Selected" && (
                        <Button size="sm" className="h-6 text-xs px-2" variant="outline"
                          onClick={() => onStatusChange?.(quotation.id, "Quoted")} data-testid="button-unselect-vendor">
                          Unselect
                        </Button>
                      )}
                      {quotation.status === "Rejected" && (
                        <Button size="sm" className="h-6 text-xs px-2" variant="outline"
                          onClick={() => onStatusChange?.(quotation.id, "Quoted")} data-testid="button-unreject-vendor">
                          Unreject
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="outline" className="text-red-600 hover:text-red-700 h-6 w-6"
                            data-testid={`button-delete-quote-${quotation.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure you want to delete the quote from {quotation.vendorName}? This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteQuote(quotation.id, quotation.vendorName)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {quotation.quotationFile && (
                        <Button size="icon" className="h-6 w-6" variant="ghost"
                          onClick={() => handleViewFile(quotation)}
                          data-testid={`button-view-file-${quotation.id}`} title="View uploaded quote file">
                          <Paperclip className="h-3 w-3" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" className="h-6 w-6" variant="ghost"
                            data-testid={`button-export-quote-${quotation.id}`}>
                            <Download className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleQuoteClick(quotation, group.projectName)} className="text-xs">
                            <Eye className="mr-2 h-3 w-3" />View Quote Details
                          </DropdownMenuItem>
                          {quotation.quotationFile && (
                            <>
                              <DropdownMenuItem onClick={() => handleViewFile(quotation)} className="text-xs">
                                <Paperclip className="mr-2 h-3 w-3" />View Attached File
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadFile(quotation)} className="text-xs">
                                <Download className="mr-2 h-3 w-3" />Download Attached File
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => handleIndividualQuoteExport(quotation, group, 'pdf')} className="text-xs">
                            <FileText className="mr-2 h-3 w-3" />Export as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleIndividualQuoteExport(quotation, group, 'excel')} className="text-xs">
                            <FileSpreadsheet className="mr-2 h-3 w-3" />Export as Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleIndividualQuoteExport(quotation, group, 'csv')} className="text-xs">
                            <FileText className="mr-2 h-3 w-3" />Export as CSV
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : (
                    // Old revision: only allow viewing the file and deleting
                    <>
                      {quotation.quotationFile && (
                        <Button size="icon" className="h-6 w-6" variant="ghost"
                          onClick={() => handleViewFile(quotation)} title="View old revision file">
                          <Paperclip className="h-3 w-3" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="outline" className="text-red-600 hover:text-red-700 h-6 w-6"
                            data-testid={`button-delete-quote-${quotation.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Old Revision</AlertDialogTitle>
                            <AlertDialogDescription>Remove this old revision from {quotation.vendorName}? This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteQuote(quotation.id, quotation.vendorName)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        });
      });
    });

    return rows;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold" data-testid="heading-comparative-quotes">
              Comparative Quotes
            </h1>
            <p className="text-sm text-muted-foreground">
              Compare vendor quotations side-by-side by project and category
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {Object.keys(groupedData).length} comparison groups
              </span>
            </div>
            
            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isExporting || filteredQuotations.length === 0}
                  data-testid="button-export-quotes"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={handleExportCSV} 
                disabled={isExporting || filteredQuotations.length === 0}
                data-testid="menu-item-export-csv"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleExportExcel} 
                disabled={isExporting || filteredQuotations.length === 0}
                data-testid="menu-item-export-excel"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem 
                disabled={true}
                data-testid="menu-item-export-pdf"
                className="opacity-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF (Coming Soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Project</label>
              <Select value={selectedProject} onValueChange={handleProjectFilter}>
                <SelectTrigger data-testid="select-project-filter" className="h-8">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  {sortProjectsForDropdown(projects).map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Category</label>
              <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter" className="h-8">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {flatCategories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center">
                        {category.level > 0 && (
                          <span style={{ marginLeft: `${category.level * 16}px` }} className="text-muted-foreground">
                            <ChevronRight className="h-3 w-3 inline mr-1" />
                          </span>
                        )}
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Vendor</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search vendor name..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  className="h-8 pl-8 pr-7 text-sm"
                  data-testid="input-vendor-search"
                />
                {vendorSearch && (
                  <button
                    type="button"
                    onClick={() => setVendorSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state when no project selected */}
      {!selectedProject && (
        <Card>
          <CardContent className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a project to begin</h3>
            <p className="text-muted-foreground">
              Choose a project from the dropdown above to view comparative quotes
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comparison Groups */}
      {selectedProject && Object.entries(groupedData)
        .sort((a, b) => a[1].category.localeCompare(b[1].category, undefined, { sensitivity: 'base' }))
        .map(([key, group]) => {
        return (
          <QuoteGroupSection key={key} label={`${group.category} — ${group.projectName}`} count={new Set(group.quotations.map((q: any) => q.vendorName)).size} open={openGroups.has(key)} onOpenChange={(isOpen) => setOpenGroups(prev => { const next = new Set(prev); isOpen ? next.add(key) : next.delete(key); return next; })}>
          <Card>
            <CardContent className="pt-0 overflow-x-auto">
              <Table className="table-fixed min-w-[900px]">
                <colgroup>
                  <col className={hideValueColumns ? "w-[28%]" : "w-[20%]"} />
                  {!hideValueColumns && (
                    <>
                      <col className="w-[15%]" />
                      <col className="w-[10%]" />
                    </>
                  )}
                  <col className="w-[12%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
                  <col className={hideValueColumns ? "w-[30%]" : "w-[18%]"} />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="text-xs font-medium">Vendor</TableHead>
                    {!hideValueColumns && (
                      <>
                        <TableHead className="text-xs font-medium">Quote Value</TableHead>
                        <TableHead className="text-xs font-medium">Variance</TableHead>
                      </>
                    )}
                    <TableHead className="text-xs font-medium">Quote Date</TableHead>
                    <TableHead className="text-xs font-medium">Uploaded</TableHead>
                    <TableHead className="text-xs font-medium">Status</TableHead>
                    <TableHead className="text-xs font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderQuoteTableBody(group.quotations, group)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          </QuoteGroupSection>
        );
      })}

      {/* Comparative Statements Section */}
      {Object.keys(groupedComparativeData).length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4">Unit Rate Comparative Statements</h2>
          {Object.entries(groupedComparativeData)
            .sort((a, b) => a[1].category.localeCompare(b[1].category, undefined, { sensitivity: 'base' }))
            .map(([key, group]) => {
            return (
              <QuoteGroupSection key={key} label={`${group.category} — ${group.projectName}`} count={new Set(group.quotations.map((q: any) => q.vendorName)).size} open={openGroups.has(key)} onOpenChange={(isOpen) => setOpenGroups(prev => { const next = new Set(prev); isOpen ? next.add(key) : next.delete(key); return next; })}>
              <Card>
                <CardContent className="pt-0 overflow-x-auto">
                  <Table className="table-fixed min-w-[900px]">
                    <colgroup>
                      <col className={hideValueColumns ? "w-[28%]" : "w-[20%]"} />
                      {!hideValueColumns && (
                        <>
                          <col className="w-[15%]" />
                          <col className="w-[10%]" />
                        </>
                      )}
                      <col className="w-[12%]" />
                      <col className="w-[15%]" />
                      <col className="w-[10%]" />
                      <col className={hideValueColumns ? "w-[30%]" : "w-[18%]"} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="h-8">
                        <TableHead className="text-xs font-medium">Vendor</TableHead>
                        {!hideValueColumns && (
                          <>
                            <TableHead className="text-xs font-medium">Quote Value</TableHead>
                            <TableHead className="text-xs font-medium">Variance</TableHead>
                          </>
                        )}
                        <TableHead className="text-xs font-medium">Quote Date</TableHead>
                        <TableHead className="text-xs font-medium">Uploaded</TableHead>
                        <TableHead className="text-xs font-medium">Status</TableHead>
                        <TableHead className="text-xs font-medium">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renderQuoteTableBody(group.quotations, group, true)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              </QuoteGroupSection>
            );
          })}
        </div>
      )}

      {Object.keys(groupedData).length === 0 && Object.keys(groupedComparativeData).length === 0 && (
        <Card className="text-center py-8">
          <CardContent>
            <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-comparisons">
              No quotations available for comparison with the selected filters.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quote Detail Modal */}
      <QuoteDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        quoteId={selectedQuoteId}
        vendorName={modalData?.vendorName}
        projectName={modalData?.projectName}
      />

      {/* Edit Quote Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={handleCloseEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quotationName">Quote Title</Label>
              <Input
                id="quotationName"
                type="text"
                placeholder="e.g., Main Quote, Option A, Kitchen Cabinets"
                value={editFormData.quotationName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, quotationName: e.target.value }))}
                data-testid="input-edit-quotation-name"
              />
            </div>
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="quotationValue">Quote Value (excl. GST)</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input
                      id="quotationValue"
                      type="number"
                      step="0.01"
                      placeholder="Base amount before GST"
                      value={editFormData.quotationValue}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, quotationValue: e.target.value }))}
                      data-testid="input-edit-quotation-value"
                    />
                    {(editingQuote?.quotationFile || editingQuote?.quoteFileId) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={handleAutoExtractAmount}
                        disabled={isExtractingAmount}
                        title="Read base amount and GST rate from the attached PDF"
                      >
                        {isExtractingAmount
                          ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          : <Sparkles className="h-4 w-4 mr-1" />}
                        Auto-read
                      </Button>
                    )}
                  </div>
                </div>
                <div className="w-24">
                  <Label htmlFor="gstPercent">GST %</Label>
                  <Input
                    id="gstPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="18"
                    className="mt-1"
                    value={editFormData.gstPercent}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, gstPercent: e.target.value }))}
                    data-testid="input-edit-gst-percent"
                  />
                </div>
              </div>
              {editFormData.quotationValue && editFormData.gstPercent && (() => {
                const base = parseFloat(editFormData.quotationValue);
                const gst = parseFloat(editFormData.gstPercent);
                if (!isNaN(base) && !isNaN(gst) && gst > 0) {
                  const total = base * (1 + gst / 100);
                  return (
                    <p className="text-xs text-muted-foreground mt-1">
                      Total incl. GST: <span className="font-medium text-foreground">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </p>
                  );
                }
                return null;
              })()}
            </div>
            <div>
              <Label htmlFor="dateOfQuotation">Date of Quotation</Label>
              <Input
                id="dateOfQuotation"
                type="date"
                value={editFormData.dateOfQuotation}
                onChange={(e) => setEditFormData(prev => ({ ...prev, dateOfQuotation: e.target.value }))}
                data-testid="input-edit-quotation-date"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                data-testid="textarea-edit-notes"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isNegotiated"
                checked={editFormData.isNegotiated}
                onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, isNegotiated: checked as boolean }))}
                data-testid="checkbox-is-negotiated"
              />
              <Label htmlFor="isNegotiated" className="text-sm font-normal cursor-pointer">
                Mark as final negotiated quote
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseEditModal} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={updateQuoteMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateQuoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FileViewerModal
        isOpen={fileViewerOpen}
        onClose={() => setFileViewerOpen(false)}
        fileUrl={fileViewerUrl}
        fileName={fileViewerName}
      />
    </div>
  );
}