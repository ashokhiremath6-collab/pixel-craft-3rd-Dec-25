import { useState, useMemo } from "react";
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
  ExternalLink
} from "lucide-react";
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
  WorksOrderItem
} from "@shared/schema";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [activeTab, setActiveTab] = useState("orders");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Template state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorksOrderTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: "",
    description: "",
    templateContent: "",
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
  
  // Cascading dropdown state
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  
  // Item management state
  type LocalItem = {
    id?: string;
    description: string;
    quantity: number;
    unit: string;
    unitRate: number;
    totalAmount: number;
    category?: string;
    itemCode?: string;
    specifications?: string;
    sourceProjectVendorId?: string;
    sourceWorksOrderId?: string;
  };
  const [items, setItems] = useState<LocalItem[]>([]);
  
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

  // Fetch project vendors (quotations)
  const { data: projectVendors = [] } = useQuery<ProjectVendor[]>({
    queryKey: ['/api/project-vendors'],
  });

  // Conditional query for categories with quotes
  const { data: categoriesWithQuotes = [] } = useQuery<Array<{ category: string; quotesCount: number }>>({
    queryKey: [`/api/projects/${selectedProjectId}/categories-with-quotes`],
    enabled: !!selectedProjectId,
  });

  // Conditional query for quotes by category
  const { data: quotesByCategory = [] } = useQuery<Array<ProjectVendor & { vendorName: string }>>({
    queryKey: [`/api/projects/${selectedProjectId}/quotes?category=${encodeURIComponent(selectedCategory)}`],
    enabled: !!selectedProjectId && !!selectedCategory,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateFormData) => {
      return apiRequest('POST', "/api/works-order-templates", {
        ...data,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-order-templates"] });
      setTemplateDialogOpen(false);
      resetTemplateForm();
      toast({
        title: "Success",
        description: "Template created successfully",
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

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof templateFormData }) => {
      return apiRequest('PUT', `/api/works-order-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/works-order-templates"] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      resetTemplateForm();
      toast({
        title: "Success",
        description: "Template updated successfully",
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
      if (projectFilter !== "all") {
        const pv = projectVendors.find(v => v.id === order.projectVendorId);
        if (!pv || pv.projectId !== projectFilter) return false;
      }
      
      // Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          order.orderNumber.toLowerCase().includes(query) ||
          (order.scope && order.scope.toLowerCase().includes(query)) ||
          (order.paymentTerms && order.paymentTerms.toLowerCase().includes(query))
        );
      }
      
      return true;
    });
  }, [orders, projectFilter, statusFilter, searchQuery, projectVendors]);

  // Helper functions
  const resetTemplateForm = () => {
    setTemplateFormData({
      name: "",
      description: "",
      templateContent: "",
    });
    setEditingTemplate(null);
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
    setSelectedProjectId("");
    setSelectedCategory("");
    setSelectedQuoteId("");
    setItems([]);
    setEditingOrder(null);
  };

  // Item management helpers
  const mergeItems = (existingItems: LocalItem[], newItems: LocalItem[]): LocalItem[] => {
    const merged = [...existingItems];
    
    for (const newItem of newItems) {
      const dedupeKey = [
        newItem.description.trim().toLowerCase(),
        newItem.unit.trim().toLowerCase(),
        (newItem.category || '').trim().toLowerCase(),
        (newItem.itemCode || '').trim().toLowerCase(),
        (newItem.specifications || '').trim().toLowerCase(),
        newItem.unitRate.toString(),
      ].join('|');
      
      const existingIndex = merged.findIndex(item => {
        const itemKey = [
          item.description.trim().toLowerCase(),
          item.unit.trim().toLowerCase(),
          (item.category || '').trim().toLowerCase(),
          (item.itemCode || '').trim().toLowerCase(),
          (item.specifications || '').trim().toLowerCase(),
          item.unitRate.toString(),
        ].join('|');
        return itemKey === dedupeKey;
      });
      
      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          quantity: merged[existingIndex].quantity + newItem.quantity,
          totalAmount: Number((merged[existingIndex].quantity + newItem.quantity) * merged[existingIndex].unitRate),
        };
      } else {
        merged.push(newItem);
      }
    }
    
    return merged;
  };

  const recalculateTotal = (items: LocalItem[]): number => {
    return items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  };

  const handleCreateTemplate = () => {
    resetTemplateForm();
    setTemplateDialogOpen(true);
  };

  const handleEditTemplate = (template: WorksOrderTemplate) => {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name,
      description: template.description || "",
      templateContent: template.templateContent,
    });
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
    
    const pv = projectVendors.find(v => v.id === order.projectVendorId);
    if (pv) {
      setSelectedProjectId(pv.projectId);
      setSelectedCategory(pv.category || "");
      setSelectedQuoteId(order.projectVendorId);
    }
    
    setOrderDialogOpen(true);
  };

  const handleViewOrder = (order: WorksOrder) => {
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

  const handleSubmitTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        data: templateFormData,
      });
    } else {
      createTemplateMutation.mutate(templateFormData);
    }
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
    <div className="h-full flex flex-col">
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
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="orders" data-testid="tab-works-orders">Works Orders</TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            </TabsList>
          </div>

          {/* Works Orders Tab */}
          <TabsContent value="orders" className="flex-1 overflow-hidden flex flex-col mt-0">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Works Orders</h2>
                <Button onClick={handleCreateOrder} data-testid="button-create-order">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Order
                </Button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger data-testid="select-project-filter">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((project) => (
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

            {/* Orders List */}
            <div className="flex-1 overflow-auto p-6">
              {ordersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No works orders found
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredOrders.map((order) => {
                    const pv = projectVendors.find(v => v.id === order.projectVendorId);
                    const project = projects.find(p => p.id === pv?.projectId);
                    
                    return (
                      <Card key={order.id} className="hover-elevate" data-testid={`card-order-${order.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold" data-testid={`text-order-number-${order.id}`}>
                                  {order.orderNumber}
                                </h3>
                                <Badge 
                                  className={STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}
                                  data-testid={`badge-status-${order.id}`}
                                >
                                  {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-muted-foreground mb-1">
                                {project?.projectName || 'Unknown Project'}
                              </p>
                              
                              {order.scope && (
                                <p className="text-sm mt-2" data-testid={`text-description-${order.id}`}>
                                  {order.scope}
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

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-menu-${order.id}`}>
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewOrder(order)} data-testid={`menu-view-${order.id}`}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                
                                {order.status === 'draft' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleEditOrder(order)} data-testid={`menu-edit-${order.id}`}>
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleSendOrder(order)} data-testid={`menu-send-${order.id}`}>
                                      <Send className="w-4 h-4 mr-2" />
                                      Send to Client
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
                                
                                {order.status === 'draft' && (
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
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="flex-1 overflow-hidden flex flex-col mt-0">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Templates</h2>
                <Button onClick={handleCreateTemplate} data-testid="button-create-template">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-auto p-6">
              {templatesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : templates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No templates found. Create your first template to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-base" data-testid={`text-template-name-${template.id}`}>
                          {template.name}
                        </CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-template-menu-${template.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditTemplate(template)} data-testid={`menu-edit-template-${template.id}`}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
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
                      </CardHeader>
                      <CardContent>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mb-3" data-testid={`text-template-desc-${template.id}`}>
                            {template.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {template.isActive ? 'Active' : 'Inactive'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-template">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitTemplate}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                  placeholder="e.g., Standard Works Order"
                  required
                  data-testid="input-template-name"
                />
              </div>

              <div>
                <Label htmlFor="template-description">Description</Label>
                <Input
                  id="template-description"
                  value={templateFormData.description}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                  placeholder="Brief description of this template"
                  data-testid="input-template-description"
                />
              </div>

              <div>
                <Label htmlFor="template-content">Template Content *</Label>
                <Textarea
                  id="template-content"
                  value={templateFormData.templateContent}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, templateContent: e.target.value })}
                  placeholder="Enter template content with merge fields: {{orderNumber}}, {{projectName}}, {{clientName}}, {{scope}}, {{totalValue}}, {{startDate}}, {{completionDate}}"
                  rows={12}
                  required
                  data-testid="input-template-content"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Available merge fields: {`{{orderNumber}}, {{projectName}}, {{clientName}}, {{scope}}, {{totalValue}}, {{startDate}}, {{completionDate}}, {{paymentTerms}}`}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)} data-testid="button-cancel-template">
                Cancel
              </Button>
              <Button type="submit" disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending} data-testid="button-save-template">
                {editingTemplate ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-order">
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

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="order-project">Project *</Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={(value) => {
                      setSelectedProjectId(value);
                      setSelectedCategory("");
                      setSelectedQuoteId("");
                      setOrderFormData({ ...orderFormData, projectVendorId: "" });
                    }}
                    required
                  >
                    <SelectTrigger id="order-project" data-testid="select-order-project">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="order-category">Category *</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => {
                      setSelectedCategory(value);
                      setSelectedQuoteId("");
                      setOrderFormData({ ...orderFormData, projectVendorId: "" });
                    }}
                    disabled={!selectedProjectId}
                    required
                  >
                    <SelectTrigger id="order-category" data-testid="select-order-category">
                      <SelectValue placeholder={selectedProjectId ? "Select category" : "Select project first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesWithQuotes.map((cat) => (
                        <SelectItem key={cat.category} value={cat.category}>
                          {cat.category} ({cat.quotesCount} {cat.quotesCount === 1 ? 'quote' : 'quotes'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="order-quote">Quote *</Label>
                  <Select
                    value={selectedQuoteId}
                    onValueChange={(value) => {
                      setSelectedQuoteId(value);
                      setOrderFormData({ ...orderFormData, projectVendorId: value });
                    }}
                    disabled={!selectedCategory}
                    required
                  >
                    <SelectTrigger id="order-quote" data-testid="select-order-quote">
                      <SelectValue placeholder={selectedCategory ? "Select quote" : "Select category first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {quotesByCategory.map((quote) => (
                        <SelectItem key={quote.id} value={quote.id}>
                          {quote.vendorName} - {quote.quotationName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
    </div>
  );
}
