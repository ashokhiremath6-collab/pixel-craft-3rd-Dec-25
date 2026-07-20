import { FileViewerModal } from "@/components/FileViewerModal";
import { useState, useMemo, useEffect, useRef } from "react";
import { sortProjectsForDropdown } from "@/lib/projectSort";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  FileText, 
  Send, 
  Ban,
  Copy,
  ExternalLink,
  Upload,
  Download,
  Eye,
  X,
  Loader2,
  AlertTriangle,
  ChevronDown
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { 
  WorksOrderTemplate, 
  WorksOrder, 
  Project, 
  ProjectVendor,
  Vendor,
} from "@shared/schema";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecentBadge } from "@/components/RecentBadge";

const STATUS_COLORS = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  signed: "bg-green-500",
  void: "bg-red-500",
};

const STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  void: "Voided",
};

export default function WorksOrdersPage() {
  const { toast } = useToast();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerFileName, setViewerFileName] = useState("");
  const openInViewer = (url: string, name?: string) => {
    setViewerUrl(url);
    setViewerFileName(name || "");
    setViewerOpen(true);
  };
  const [activeTab, setActiveTab] = useState("orders");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const categoriesInitialized = useRef(false);

  // Template state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateFormData, setTemplateFormData] = useState({
    categoryId: "",
    categoryName: "",
    description: "",
    file: null as File | null,
  });
  
  // Order state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorksOrder | null>(null);
  const [orderFormData, setOrderFormData] = useState({
    title: "",
    templateId: "",
    projectVendorId: "",
    scope: "",
    totalValue: "",
    startDate: "",
    completionDate: "",
    paymentTerms: "",
  });
  
  // Detail drawer state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorksOrder | null>(null);
  
  // Void dialog state
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [orderToVoid, setOrderToVoid] = useState<WorksOrder | null>(null);
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'template' | 'order'; id: string } | null>(null);
  
  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFormData, setImportFormData] = useState({
    projectId: "",
    categoryId: "",
    categoryName: "",
    vendorId: "",
    files: [] as File[],
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<WorksOrderTemplate[]>({
    queryKey: ["/api/works-order-templates"],
  });

  // Fetch works orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<WorksOrder[]>({
    queryKey: ["/api/works-orders"],
  });

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Auto-select the first project alphabetically when projects load
  useEffect(() => {
    if (projects.length > 0 && !projectFilter) {
      const sorted = sortProjectsForDropdown(projects);
      if (sorted.length > 0) setProjectFilter(sorted[0].id);
    }
  }, [projects, projectFilter]);

  // Fetch project vendors (quotations)
  const { data: projectVendors = [] } = useQuery<ProjectVendor[]>({
    queryKey: ['/api/project-vendors'],
  });

  // Fetch all vendors for name lookup
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
  });

  // Fetch vendor categories for dropdown
  const { data: vendorCategories = [] } = useQuery<any[]>({
    queryKey: ['/api/vendor-categories/tree'],
  });

  // Fetch vendors for selected category in import dialog
  const { data: categoryVendors = [] } = useQuery<any[]>({
    queryKey: [`/api/vendors/category/${importFormData.categoryId}`],
    enabled: !!importFormData.categoryId,
  });

  // Fetch files for selected works order
  const { data: orderFiles = [] } = useQuery<any[]>({
    queryKey: [`/api/works-orders/${selectedOrder?.id}/files`],
    enabled: !!selectedOrder?.id,
  });

  // Flatten categories for dropdown — must be before alert computations
  const flatCategories = useMemo(() => {
    const flatten = (categories: any[], level = 0): any[] => {
      return categories.flatMap(cat => [
        { ...cat, level },
        ...flatten(cat.children || [], level + 1)
      ]);
    };
    return flatten(vendorCategories);
  }, [vendorCategories]);

  // Helper: resolve a PV's category name the same way /api/quotations does —
  // via vendor.categoryId → flatCategories, NOT pv.category (which is null for most rows).
  const pvCategoryName = (pv: ProjectVendor): string | null => {
    if (!pv.vendorId) return null; // comparative statement rows — skip
    const vendor = vendors.find((v) => v.id === pv.vendorId);
    if (!vendor?.categoryId) return null;
    const cat = flatCategories.find((c) => c.id === vendor.categoryId);
    return cat?.name ?? null;
  };

  // Category groups (project + category) where NO quote has been selected yet.
  // Non-option items create the group entries (avoid double-counting categories).
  // Options are skipped for group creation but still mark hasSelected if they are Selected,
  // because in practice the selected item is often an "option" sub-quote.
  const unselectedGroups = useMemo(() => {
    const groups = new Map<string, { projectId: string; projectName: string; category: string; hasSelected: boolean }>();
    projectVendors.forEach((pv) => {
      const categoryName = pvCategoryName(pv);
      if (!categoryName) return;
      const key = `${pv.projectId}__${categoryName}`;
      // Only non-option PVs create the group entry (prevents double-counting)
      if (pv.quotationType !== "option") {
        const project = projects.find((p) => p.id === pv.projectId);
        if (!groups.has(key)) {
          groups.set(key, {
            projectId: pv.projectId,
            projectName: project?.projectName ?? "Unknown Project",
            category: categoryName,
            hasSelected: false,
          });
        }
      }
      // All PVs (including options) can mark the group as having a selection
      if (pv.status === "Selected" && groups.has(key)) {
        groups.get(key)!.hasSelected = true;
      }
    });
    return Array.from(groups.values())
      .filter((g) => !g.hasSelected)
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [projectVendors, vendors, flatCategories, projects]);

  // Selected quotations that have no works order (draft, sent, or signed) yet.
  // A Selected quote is considered "covered" if ANY non-void works order exists for the
  // same project + category — regardless of which specific PV the order was linked to.
  // This handles imported orders that may be linked to a 'Quoted' PV in the same category
  // rather than the exact 'Selected' PV.
  const unissuedItems = useMemo(() => {
    // Resolve the effective categoryId for a PV.
    // For regular quotes: vendor.categoryId is always set and is the ground truth.
    // For comparative rows (no vendorId): fall back to pv.categoryId which IS set on those rows.
    // pv.categoryId alone is unreliable for regular quotes (it's nullable there).
    const pvEffectiveCategoryId = (pv: ProjectVendor): string | null => {
      if (pv.vendorId) {
        const vendor = vendors.find((v) => v.id === pv.vendorId);
        return vendor?.categoryId ?? pv.categoryId ?? null;
      }
      return pv.categoryId ?? null; // comparative rows: pv.categoryId is set directly
    };
    // Build a lookup: pvId → { projectId, effectiveCategoryId }
    const pvLookup = new Map(
      projectVendors.map((pv) => [pv.id, { projectId: pv.projectId, categoryId: pvEffectiveCategoryId(pv) }])
    );
    // Collect all project+category pairs that have at least one non-void works order
    const coveredKeys = new Set<string>();
    orders
      .filter((o) => o.status !== "void")
      .forEach((o) => {
        const pv = pvLookup.get(o.projectVendorId);
        if (pv?.categoryId) coveredKeys.add(`${pv.projectId}:${pv.categoryId}`);
      });
    return projectVendors
      .filter((pv) => {
        if (pv.status !== "Selected") return false;
        const catId = pvEffectiveCategoryId(pv);
        if (!catId) return false; // no category resolvable — skip
        // Covered if any non-void order exists for the same project + category
        return !coveredKeys.has(`${pv.projectId}:${catId}`);
      })
      .map((pv) => {
        const vendor = vendors.find((v) => v.id === pv.vendorId);
        const project = projects.find((p) => p.id === pv.projectId);
        const categoryName = pvCategoryName(pv);
        return {
          id: pv.id,
          vendorName: vendor?.name ?? "Unknown Vendor",
          projectName: project?.projectName ?? "Unknown Project",
          category: categoryName ?? "",
        };
      });
  }, [projectVendors, orders, vendors, flatCategories, projects]);
  const unissuedCount = unissuedItems.length;

  const totalAlertCount = unissuedCount + unselectedGroups.length;
  const [draftAlertDismissed, setDraftAlertDismissed] = useState(false);
  const [draftAlertOpen, setDraftAlertOpen] = useState(false);

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped = new Map<string, { categoryName: string; templates: WorksOrderTemplate[] }>();
    
    templates.forEach((template) => {
      let categoryId: string;
      let categoryName: string;
      
      // Templates with no categoryId go under "Terms of Contract Templates"
      if (!template.categoryId) {
        categoryId = '__terms_of_contract__';
        categoryName = 'Terms of Contract Templates';
      } else {
        const category = flatCategories.find((cat) => cat.id === template.categoryId);
        categoryName = category?.name || 'Uncategorized';
        categoryId = template.categoryId;
      }
      
      if (!grouped.has(categoryId)) {
        grouped.set(categoryId, { categoryName, templates: [] });
      }
      grouped.get(categoryId)!.templates.push(template);
    });
    
    // Sort: Terms of Contract first, then others alphabetically
    return Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === '__terms_of_contract__') return -1;
      if (b[0] === '__terms_of_contract__') return 1;
      return a[1].categoryName.localeCompare(b[1].categoryName);
    });
  }, [templates, flatCategories]);

  // Import template mutation
  const importTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateFormData) => {
      const formData = new FormData();
      if (data.categoryId) formData.append('categoryId', data.categoryId);
      if (data.categoryName) formData.append('categoryName', data.categoryName);
      if (data.description) formData.append('description', data.description);
      if (data.file) formData.append('file', data.file);
      
      const response = await fetch('/api/works-order-templates/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(errorData.error || 'Import failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-order-templates"] });
      setTemplateDialogOpen(false);
      resetTemplateForm();
      toast({
        title: "Success",
        description: "Template imported successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/works-order-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-order-templates"] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: typeof orderFormData) => {
      return apiRequest('POST', "/api/works-orders", {
        ...data,
        totalValue: data.totalValue ? parseFloat(data.totalValue) : null,
        startDate: data.startDate || null,
        completionDate: data.completionDate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-orders"] });
      setOrderDialogOpen(false);
      resetOrderForm();
      toast({
        title: "Success",
        description: "Works order created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof orderFormData }) => {
      return apiRequest('PUT', `/api/works-orders/${id}`, {
        ...data,
        totalValue: data.totalValue ? parseFloat(data.totalValue) : null,
        startDate: data.startDate || null,
        completionDate: data.completionDate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-orders"] });
      setOrderDialogOpen(false);
      setEditingOrder(null);
      resetOrderForm();
      toast({
        title: "Success",
        description: "Works order updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send order mutation
  const sendOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/works-orders/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-orders"] });
      toast({
        title: "Success",
        description: "Works order sent to client",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Void order mutation
  const voidOrderMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest('POST', `/api/works-orders/${id}/void`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-orders"] });
      setVoidDialogOpen(false);
      setVoidReason("");
      setOrderToVoid(null);
      toast({
        title: "Success",
        description: "Works order voided",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/works-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-orders"] });
      toast({
        title: "Success",
        description: "Works order deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Project filter
      if (projectFilter) {
        const pv = projectVendors.find(v => v.id === order.projectVendorId);
        if (!pv || pv.projectId !== projectFilter) return false;
      }
      
      // Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }
      
      // Search filter — matches order number, scope, payment terms, or vendor name
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const pv = projectVendors.find(v => v.id === order.projectVendorId);
        const vendor = pv?.vendorId ? vendors.find(v => v.id === pv.vendorId) : null;
        const vendorName = vendor?.name ?? "";
        return (
          order.orderNumber.toLowerCase().includes(query) ||
          (order.scope && order.scope.toLowerCase().includes(query)) ||
          (order.paymentTerms && order.paymentTerms.toLowerCase().includes(query)) ||
          vendorName.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [orders, projectFilter, statusFilter, searchQuery, projectVendors]);

  // Group orders by category
  const ordersByCategory = useMemo(() => {
    const grouped = new Map<string, any[]>();
    
    filteredOrders.forEach((order: any) => {
      const category = order.category || 'Uncategorized';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(order);
    });
    
    // Sort categories alphabetically
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredOrders]);

  // Collapse all categories by default when data first loads (must be after ordersByCategory is defined)
  useEffect(() => {
    if (!categoriesInitialized.current && ordersByCategory.length > 0) {
      categoriesInitialized.current = true;
      setCollapsedCategories(new Set(ordersByCategory.map(([cat]) => cat)));
    }
  }, [ordersByCategory]);

  // Helper functions
  const resetTemplateForm = () => {
    setTemplateFormData({
      categoryId: "",
      categoryName: "",
      description: "",
      file: null,
    });
  };

  const resetOrderForm = () => {
    setOrderFormData({
      title: "",
      templateId: "",
      projectVendorId: "",
      scope: "",
      totalValue: "",
      startDate: "",
      completionDate: "",
      paymentTerms: "",
    });
    setEditingOrder(null);
  };

  const handleImportTemplate = () => {
    resetTemplateForm();
    setTemplateDialogOpen(true);
  };

  const handleCreateOrder = () => {
    resetOrderForm();
    setOrderDialogOpen(true);
  };

  const handleEditOrder = (order: WorksOrder) => {
    setEditingOrder(order);
    setOrderFormData({
      title: order.title,
      templateId: order.templateId || "",
      projectVendorId: order.projectVendorId,
      scope: order.scope,
      totalValue: order.totalValue ? order.totalValue.toString() : "",
      startDate: order.startDate || "",
      completionDate: order.completionDate || "",
      paymentTerms: order.paymentTerms || "",
    });
    setOrderDialogOpen(true);
  };

  const handleViewOrder = (order: WorksOrder) => {
    // Open detail drawer
    setSelectedOrder(order);
    setDetailDrawerOpen(true);
  };

  const handleSendOrder = (order: WorksOrder) => {
    if (order.status !== 'draft') {
      toast({
        title: "Error",
        description: "Only draft orders can be sent",
        variant: "destructive",
      });
      return;
    }
    sendOrderMutation.mutate(order.id);
  };

  const handleVoidOrder = (order: WorksOrder) => {
    setOrderToVoid(order);
    setVoidDialogOpen(true);
  };

  const handleCopySigningLink = (order: WorksOrder) => {
    const signUrl = `${window.location.origin}/sign/${order.accessToken}`;
    navigator.clipboard.writeText(signUrl);
    toast({
      title: "Success",
      description: "Signing link copied to clipboard",
    });
  };

  const handleOpenSigningLink = (order: WorksOrder) => {
    const signUrl = `/sign/${order.accessToken}`;
    window.open(signUrl, '_blank');
  };

  const handleImportOrder = () => {
    setImportFormData({
      projectId: "",
      categoryId: "",
      categoryName: "",
      vendorId: "",
      files: [],
    });
    setImportDialogOpen(true);
  };

  const handleImportSubmit = async () => {
    // Validate required fields
    if (!importFormData.projectId || !importFormData.categoryId || !importFormData.vendorId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate at least one file is selected
    if (importFormData.files.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one file to upload",
        variant: "destructive",
      });
      return;
    }

    // Prevent double-clicks
    if (isImporting) return;
    setIsImporting(true);

    const formData = new FormData();
    formData.append('projectId', importFormData.projectId);
    formData.append('categoryId', importFormData.categoryId);
    formData.append('categoryName', importFormData.categoryName);
    formData.append('vendorId', importFormData.vendorId);
    
    // Append all files
    importFormData.files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/works-orders/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(errorData.error || 'Import failed');
      }

      queryClient.invalidateQueries({ queryKey: ["/api/works-orders"] });
      setImportDialogOpen(false);
      toast({
        title: "Success",
        description: `Works order imported successfully with ${importFormData.files.length} file(s)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import works order",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportOrder = async (order: any) => {
    try {
      // Extract the file path from the scope field
      const filePathMatch = order.scope?.match(/File path: (.+)$/);
      if (!filePathMatch) {
        toast({
          title: "Error",
          description: "No file found for this works order",
          variant: "destructive",
        });
        return;
      }

      const filePath = filePathMatch[1];
      openInViewer(filePath);

      toast({
        title: "Success",
        description: "Opening works order file",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export works order",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (type: 'template' | 'order', id: string) => {
    setItemToDelete({ type, id });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    
    if (itemToDelete.type === 'template') {
      deleteTemplateMutation.mutate(itemToDelete.id);
    } else {
      deleteOrderMutation.mutate(itemToDelete.id);
    }
    
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleCategoryChange = (value: string) => {
    // Handle special case for Terms of Contract (no category)
    if (value === '__terms_of_contract__') {
      setTemplateFormData({
        ...templateFormData,
        categoryId: "",
        categoryName: "Terms of Contract",
      });
    } else {
      const category = flatCategories.find((cat: any) => cat.id === value);
      setTemplateFormData({
        ...templateFormData,
        categoryId: value,
        categoryName: category?.name || "",
      });
    }
  };

  const handleSubmitTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!templateFormData.file) {
      toast({
        title: "Error",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }
    
    importTemplateMutation.mutate(templateFormData);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOrder) {
      updateOrderMutation.mutate({
        id: editingOrder.id,
        data: orderFormData,
      });
    } else {
      createOrderMutation.mutate(orderFormData);
    }
  };

  const handleSubmitVoid = () => {
    if (!orderToVoid) return;
    voidOrderMutation.mutate({
      id: orderToVoid.id,
      reason: voidReason,
    });
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Works Orders</h1>
            <p className="text-sm text-muted-foreground">Manage works order templates and client approvals</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="orders" data-testid="tab-works-orders">Works Orders</TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            </TabsList>
          </div>

          {/* Works Orders Tab */}
          <TabsContent value="orders" className="mt-0">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Works Orders</h2>
                <div className="flex gap-2">
                  <Button onClick={handleImportOrder} data-testid="button-import-order">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Works Order
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger data-testid="select-project-filter">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortProjectsForDropdown(projects).map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="void">Voided</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="md:col-span-2"
                  data-testid="input-search"
                />
              </div>
            </div>

            {/* Pending actions alert */}
            {!draftAlertDismissed && totalAlertCount > 0 && (
              <div className="px-6 pt-4">
                <Collapsible open={draftAlertOpen} onOpenChange={setDraftAlertOpen}>
                  <div className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="flex-1 text-sm">
                        <strong>{totalAlertCount}</strong> {totalAlertCount === 1 ? "item requires" : "items require"} attention —
                        {unselectedGroups.length > 0 && (
                          <> <strong>{unselectedGroups.length}</strong> {unselectedGroups.length === 1 ? "category has" : "categories have"} no quote selected</>
                        )}
                        {unselectedGroups.length > 0 && unissuedCount > 0 && <>, </>}
                        {unissuedCount > 0 && (
                          <> <strong>{unissuedCount}</strong> selected {unissuedCount === 1 ? "quote has" : "quotes have"} no works order created</>
                        )}
                        .
                      </span>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300">
                          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${draftAlertOpen ? "rotate-180" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" onClick={() => setDraftAlertDismissed(true)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Expandable list */}
                    <CollapsibleContent>
                      <div className="border-t border-amber-500/30 divide-y divide-amber-500/20">

                        {/* No quote selected */}
                        {unselectedGroups.length > 0 && (
                          <div className="px-4 py-3 space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2">
                              No quote selected
                            </p>
                            {unselectedGroups.map((g) => (
                              <div key={`${g.projectId}__${g.category}`} className="flex items-center gap-2 text-sm">
                                <span className="font-medium">{g.category}</span>
                                <span className="text-amber-600/60 dark:text-amber-400/60">•</span>
                                <span className="text-amber-800/70 dark:text-amber-300/70">{g.projectName}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Works order not created */}
                        {unissuedItems.length > 0 && (
                          <div className="px-4 py-3 space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2">
                              Works order not created
                            </p>
                            {unissuedItems.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 flex-wrap text-sm">
                                <span className="font-medium">{item.vendorName}</span>
                                <span className="text-amber-600/60 dark:text-amber-400/60">•</span>
                                <span className="text-amber-800/70 dark:text-amber-300/70">{item.projectName}</span>
                                {item.category && (
                                  <>
                                    <span className="text-amber-600/60 dark:text-amber-400/60">•</span>
                                    <span className="text-amber-800/70 dark:text-amber-300/70">{item.category}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>
            )}

            {/* Orders List */}
            <div className="p-6">
              {ordersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No works orders found
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {ordersByCategory.map(([category, categoryOrders]) => (
                    <div key={category}>
                      <button
                        className="w-full flex items-center gap-2 mb-4 hover-elevate rounded-md px-1 -mx-1 py-0.5 text-left"
                        onClick={() => toggleCategory(category)}
                      >
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${collapsedCategories.has(category) ? '-rotate-90' : ''}`}
                        />
                        <span className="text-lg font-semibold">{category}</span>
                        <Badge variant="secondary" className="text-xs">
                          {categoryOrders.length} {categoryOrders.length === 1 ? 'order' : 'orders'}
                        </Badge>
                      </button>
                      {!collapsedCategories.has(category) && <div className="grid gap-4">
                        {categoryOrders.map((order: any) => {
                    const pv = projectVendors.find(v => v.id === order.projectVendorId);
                    const project = projects.find(p => p.id === pv?.projectId);
                    
                    return (
                      <Card key={order.id} className="hover-elevate" data-testid={`card-order-${order.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold" data-testid={`text-vendor-name-${order.id}`}>
                                  {order.vendorName || 'Unknown Vendor'}
                                </h3>
                                {order.status !== 'draft' && (
                                  <Badge 
                                    className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}
                                    data-testid={`badge-status-${order.id}`}
                                  >
                                    {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="text-sm font-medium">
                                  {order.projectName || project?.projectName || 'Unknown Project'}
                                </p>
                                <span className="text-muted-foreground">•</span>
                                {order.category && (
                                  <>
                                    <span className="text-sm text-muted-foreground">
                                      {order.category}
                                    </span>
                                    <span className="text-muted-foreground">•</span>
                                  </>
                                )}
                                <span className="text-sm text-muted-foreground" data-testid={`text-order-number-${order.id}`}>
                                  {order.orderNumber}
                                </span>
                                {(order.sentAt || order.createdAt) && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-sm text-muted-foreground" data-testid={`text-released-${order.id}`}>
                                      {order.sentAt ? 'Released' : 'Created'}: {format(new Date(order.sentAt || order.createdAt), 'MMM d, yyyy')}
                                    </span>
                                  </>
                                )}
                              </div>
                              
                              {order.scope && (
                                <p className="text-sm mt-2 text-muted-foreground" data-testid={`text-description-${order.id}`}>
                                  {order.scope.replace(/\.\s*File path:.*$/, '')}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                {order.totalValue && (
                                  <span data-testid={`text-cost-${order.id}`}>
                                    Cost: ${order.totalValue.toLocaleString()}
                                  </span>
                                )}
                                {order.startDate && (
                                  <span data-testid={`text-dates-${order.id}`}>
                                    {format(new Date(order.startDate), 'MMM d, yyyy')}
                                    {order.completionDate && ` - ${format(new Date(order.completionDate), 'MMM d, yyyy')}`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleViewOrder(order)}
                                data-testid={`button-view-${order.id}`}
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-menu-${order.id}`}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {order.status === 'draft' && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleEditOrder(order)} data-testid={`menu-edit-${order.id}`}>
                                        <Pencil className="w-4 h-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleSendOrder(order)} data-testid={`menu-send-${order.id}`}>
                                        <Send className="w-4 h-4 mr-2" />
                                        Send to Vendor
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  
                                  {order.status === 'sent' && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleCopySigningLink(order)} data-testid={`menu-copy-link-${order.id}`}>
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy Signing Link
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenSigningLink(order)} data-testid={`menu-open-link-${order.id}`}>
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        Open Signing Page
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  
                                  {order.status !== 'void' && order.status !== 'signed' && (
                                    <DropdownMenuItem onClick={() => handleVoidOrder(order)} data-testid={`menu-void-${order.id}`}>
                                      <Ban className="w-4 h-4 mr-2" />
                                      Void Order
                                    </DropdownMenuItem>
                                  )}
                                  
                                  {(order.status === 'draft' || order.status === 'void') && (
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteClick('order', order.id)}
                                      className="text-destructive"
                                      data-testid={`menu-delete-${order.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                          </Card>
                        );
                      })}
                      </div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-0">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Templates</h2>
                <Button onClick={handleImportTemplate} data-testid="button-import-template">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Template
                </Button>
              </div>
            </div>

            {/* Templates List */}
            <div className="p-6">
              {templatesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : templates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No templates found. Create your first template to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {templatesByCategory.map(([categoryId, { categoryName, templates }]) => (
                    <div key={categoryId}>
                      <h3 className="text-lg font-semibold mb-3 text-foreground" data-testid={`heading-category-${categoryId}`}>
                        {categoryName}
                      </h3>
                      <div className="space-y-2">
                        {templates.map((template) => (
                          <div 
                            key={template.id} 
                            className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                            data-testid={`row-template-${template.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium" data-testid={`text-template-name-${template.id}`}>
                                    {template.description || template.name}
                                  </p>
                                  {template.originalFileName && (
                                    <p className="text-sm text-muted-foreground" data-testid={`text-template-filename-${template.id}`}>
                                      {template.originalFileName}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {template.objectPath && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    openInViewer(template.objectPath, template.originalFileName || 'template');
                                  }}
                                  data-testid={`button-view-template-${template.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-template-menu-${template.id}`}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {template.objectPath && (
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        openInViewer(template.objectPath, template.originalFileName || 'template');
                                      }}
                                      data-testid={`menu-view-template-${template.id}`}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      View Template
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteClick('template', template.id)}
                                    className="text-destructive"
                                    data-testid={`menu-delete-template-${template.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Template Import Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-template">
          <DialogHeader>
            <DialogTitle>Import Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitTemplate}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="template-category">Category</Label>
                <Select
                  value={templateFormData.categoryId ? templateFormData.categoryId : (templateFormData.categoryName === "Terms of Contract" ? '__terms_of_contract__' : '')}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger id="template-category" data-testid="select-template-category">
                    <SelectValue placeholder="Select category or template type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__terms_of_contract__">
                      Terms of Contract Templates
                    </SelectItem>
                    {flatCategories.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-sm text-muted-foreground border-t">
                          Category Templates
                        </div>
                        {flatCategories.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {'\u00A0'.repeat(cat.level * 4)}{cat.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={templateFormData.description}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                  placeholder="Brief description of this template"
                  rows={3}
                  data-testid="input-template-description"
                />
              </div>

              <div>
                <Label htmlFor="template-file">Template File *</Label>
                <Input
                  id="template-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setTemplateFormData({ ...templateFormData, file });
                  }}
                  required
                  data-testid="input-template-file"
                />
                {templateFormData.file && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {templateFormData.file.name}
                  </p>
                )}
                {!templateFormData.file && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported formats: PDF, Word (.doc, .docx), Excel (.xls, .xlsx)
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)} data-testid="button-cancel-template">
                Cancel
              </Button>
              <Button type="submit" disabled={importTemplateMutation.isPending} data-testid="button-import-template-submit">
                <Upload className="w-4 h-4 mr-2" />
                Import Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-order">
          <DialogHeader>
            <DialogTitle>
              {editingOrder ? 'Edit Works Order' : 'Create Works Order'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitOrder}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="order-title">Works Order Title *</Label>
                <Input
                  id="order-title"
                  value={orderFormData.title}
                  onChange={(e) => setOrderFormData({ ...orderFormData, title: e.target.value })}
                  placeholder="e.g., Electrical Works - Phase 1"
                  required
                  data-testid="input-order-title"
                />
              </div>

              <div>
                <Label htmlFor="order-template">Template</Label>
                <Select
                  value={orderFormData.templateId}
                  onValueChange={(value) => setOrderFormData({ ...orderFormData, templateId: value })}
                >
                  <SelectTrigger id="order-template" data-testid="select-order-template">
                    <SelectValue placeholder="Select template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="order-project-vendor">Project / Quote *</Label>
                <Select
                  value={orderFormData.projectVendorId}
                  onValueChange={(value) => setOrderFormData({ ...orderFormData, projectVendorId: value })}
                  required
                >
                  <SelectTrigger id="order-project-vendor" data-testid="select-order-project-vendor">
                    <SelectValue placeholder="Select project and quote" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectVendors.map((pv) => {
                      const project = projects.find(p => p.id === pv.projectId);
                      return (
                        <SelectItem key={pv.id} value={pv.id}>
                          {project?.projectName} - {pv.quotationName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="order-scope">Scope of Work *</Label>
                <Textarea
                  id="order-scope"
                  value={orderFormData.scope}
                  onChange={(e) => setOrderFormData({ ...orderFormData, scope: e.target.value })}
                  placeholder="Describe the scope of work to be performed"
                  rows={4}
                  required
                  data-testid="input-order-scope"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="order-total-value">Total Value</Label>
                  <Input
                    id="order-total-value"
                    type="number"
                    step="0.01"
                    value={orderFormData.totalValue}
                    onChange={(e) => setOrderFormData({ ...orderFormData, totalValue: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-order-total-value"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="order-start-date">Start Date</Label>
                  <Input
                    id="order-start-date"
                    type="date"
                    value={orderFormData.startDate}
                    onChange={(e) => setOrderFormData({ ...orderFormData, startDate: e.target.value })}
                    data-testid="input-order-start-date"
                  />
                </div>

                <div>
                  <Label htmlFor="order-completion-date">Completion Date</Label>
                  <Input
                    id="order-completion-date"
                    type="date"
                    value={orderFormData.completionDate}
                    onChange={(e) => setOrderFormData({ ...orderFormData, completionDate: e.target.value })}
                    data-testid="input-order-completion-date"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="order-payment-terms">Payment Terms</Label>
                <Textarea
                  id="order-payment-terms"
                  value={orderFormData.paymentTerms}
                  onChange={(e) => setOrderFormData({ ...orderFormData, paymentTerms: e.target.value })}
                  placeholder="Payment schedule and terms"
                  rows={3}
                  data-testid="input-order-payment-terms"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOrderDialogOpen(false)} data-testid="button-cancel-order">
                Cancel
              </Button>
              <Button type="submit" disabled={createOrderMutation.isPending || updateOrderMutation.isPending} data-testid="button-save-order">
                {editingOrder ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Void Order Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent data-testid="dialog-void">
          <AlertDialogHeader>
            <AlertDialogTitle>Void Works Order</AlertDialogTitle>
            <AlertDialogDescription>
              This will void the works order. Please provide a reason for voiding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding this order..."
              rows={3}
              data-testid="input-void-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-void">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitVoid} disabled={voidOrderMutation.isPending} data-testid="button-confirm-void">
              Void Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={deleteTemplateMutation.isPending || deleteOrderMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Detail Drawer */}
      <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <SheetContent className="sm:max-w-xl overflow-auto" data-testid="drawer-order-detail">
          <SheetHeader>
            <SheetTitle>Works Order Details</SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <div className="mt-6 space-y-6">
              <div>
                <Label className="text-muted-foreground">Order Number</Label>
                <p className="text-lg font-semibold" data-testid="detail-order-number">{selectedOrder.orderNumber}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge className={STATUS_COLORS[selectedOrder.status as keyof typeof STATUS_COLORS]} data-testid="detail-status">
                    {STATUS_LABELS[selectedOrder.status as keyof typeof STATUS_LABELS]}
                  </Badge>
                </div>
              </div>

              {selectedOrder.scope && (
                <div>
                  <Label className="text-muted-foreground">Scope of Work</Label>
                  <p className="mt-1" data-testid="detail-scope">{selectedOrder.scope}</p>
                </div>
              )}

              {/* Files Section - Show all files under one heading */}
              {orderFiles.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Attached Files ({orderFiles.length})</Label>
                  <div className="mt-2 space-y-2">
                    {orderFiles.map((file: any, index: number) => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-md hover-elevate"
                        data-testid={`file-item-${index}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium truncate">{file.fileName}</p>
                              <RecentBadge date={file.uploadedAt} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {(parseInt(file.fileSize) / 1024).toFixed(1)} KB
                              {file.uploadedAt && ` • ${format(new Date(file.uploadedAt), 'MMM d, yyyy')}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openInViewer(file.filePath, file.fileName)}
                          data-testid={`button-view-file-${index}`}
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.totalValue && (
                <div>
                  <Label className="text-muted-foreground">Total Value</Label>
                  <p className="mt-1 text-lg font-semibold" data-testid="detail-total-value">
                    ${selectedOrder.totalValue.toLocaleString()}
                  </p>
                </div>
              )}

              {(selectedOrder.startDate || selectedOrder.completionDate) && (
                <div>
                  <Label className="text-muted-foreground">Timeline</Label>
                  <p className="mt-1" data-testid="detail-timeline">
                    {selectedOrder.startDate && format(new Date(selectedOrder.startDate), 'MMM d, yyyy')}
                    {selectedOrder.startDate && selectedOrder.completionDate && ' - '}
                    {selectedOrder.completionDate && format(new Date(selectedOrder.completionDate), 'MMM d, yyyy')}
                  </p>
                </div>
              )}

              {selectedOrder.paymentTerms && (
                <div>
                  <Label className="text-muted-foreground">Payment Terms</Label>
                  <p className="mt-1 text-sm" data-testid="detail-payment-terms">{selectedOrder.paymentTerms}</p>
                </div>
              )}

              {selectedOrder.sentAt && (
                <div>
                  <Label className="text-muted-foreground">Sent At</Label>
                  <p className="mt-1" data-testid="detail-sent-at">
                    {format(new Date(selectedOrder.sentAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}

              {selectedOrder.signedAt && (
                <div>
                  <Label className="text-muted-foreground">Signed At</Label>
                  <p className="mt-1" data-testid="detail-signed-at">
                    {format(new Date(selectedOrder.signedAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}

              {selectedOrder.voidedAt && (
                <div>
                  <Label className="text-muted-foreground">Voided At</Label>
                  <p className="mt-1" data-testid="detail-voided-at">
                    {format(new Date(selectedOrder.voidedAt), 'MMM d, yyyy h:mm a')}
                  </p>
                  {selectedOrder.voidReason && (
                    <p className="mt-2 text-sm text-muted-foreground" data-testid="detail-void-reason">
                      Reason: {selectedOrder.voidReason}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Import Works Order Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-import-works-order">
          <DialogHeader>
            <DialogTitle>Import Works Order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="import-project">Project *</Label>
              <Select
                value={importFormData.projectId}
                onValueChange={(value) => setImportFormData(prev => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger id="import-project" data-testid="select-import-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {sortProjectsForDropdown(projects).map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="import-category">Category *</Label>
              <Select
                value={importFormData.categoryId}
                onValueChange={(value) => {
                  const selectedCategory = flatCategories.find(cat => cat.id === value);
                  setImportFormData(prev => ({
                    ...prev,
                    categoryId: value,
                    categoryName: selectedCategory?.name || '',
                    vendorId: '' // Reset vendor when category changes
                  }));
                }}
              >
                <SelectTrigger id="import-category" data-testid="select-import-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {flatCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {'\u00A0'.repeat(category.level * 4)}{category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="import-vendor">Vendor <span className="text-red-500">*</span></Label>
              <Select
                value={importFormData.vendorId}
                onValueChange={(value) => setImportFormData(prev => ({ ...prev, vendorId: value }))}
                disabled={!importFormData.categoryId}
              >
                <SelectTrigger id="import-vendor" data-testid="select-import-vendor">
                  <SelectValue placeholder={importFormData.categoryId ? "Select vendor" : "Select category first"} />
                </SelectTrigger>
                <SelectContent>
                  {categoryVendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="import-file">Upload Files <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Input
                  id="import-file"
                  type="file"
                  accept="*/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportFormData(prev => ({ 
                        ...prev, 
                        files: [...prev.files, file]
                      }));
                      e.target.value = ''; // Clear input for next file
                    }
                  }}
                  data-testid="input-import-file"
                  className="flex-1"
                />
              </div>
              {importFormData.files.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">Added files ({importFormData.files.length}):</p>
                  {importFormData.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 text-sm bg-muted/50 p-2 rounded">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => {
                          setImportFormData(prev => ({
                            ...prev,
                            files: prev.files.filter((_, i) => i !== index)
                          }));
                        }}
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Choose files one at a time to add them to the upload list
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-cancel-import">
              Cancel
            </Button>
            <Button onClick={handleImportSubmit} disabled={isImporting} data-testid="button-submit-import">
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FileViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        fileUrl={viewerUrl}
        fileName={viewerFileName}
      />
    </div>
  );
}
