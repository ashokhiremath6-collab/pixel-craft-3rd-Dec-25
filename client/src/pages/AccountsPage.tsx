import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Banknote, TrendingUp, Download, AlertCircle, IndianRupee, Edit, Trash2, MoreVertical, Upload, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertVendorInvoiceSchema, insertVendorPaymentSchema } from "@shared/schema";
import type { Vendor, VendorInvoice, VendorPayment, Project } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";

type InvoiceFormData = z.infer<typeof insertVendorInvoiceSchema>;
type PaymentFormData = z.infer<typeof insertVendorPaymentSchema>;

interface LedgerEntry {
  id: string;
  date: Date;
  type: 'invoice' | 'payment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function AccountsPage() {
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [addInvoiceDialogOpen, setAddInvoiceDialogOpen] = useState(false);
  const [addPaymentDialogOpen, setAddPaymentDialogOpen] = useState(false);
  const [editInvoiceDialogOpen, setEditInvoiceDialogOpen] = useState(false);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<VendorInvoice | null>(null);
  const [editingPayment, setEditingPayment] = useState<VendorPayment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<{ id: string; type: 'invoice' | 'payment' } | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if user has permission to add invoices/payments (admin or designer)
  const canManageAccounts = user?.role === 'admin' || user?.role === 'designer';

  // Fetch all vendors
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
  });

  // Fetch all projects for invoice project selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch invoices for selected vendor
  const { data: invoices = [] } = useQuery<VendorInvoice[]>({
    queryKey: ['/api/vendors', selectedVendorId, 'invoices'],
    enabled: !!selectedVendorId,
  });

  // Fetch payments for selected vendor
  const { data: payments = [] } = useQuery<VendorPayment[]>({
    queryKey: ['/api/vendors', selectedVendorId, 'payments'],
    enabled: !!selectedVendorId,
  });

  // Invoice form
  const invoiceForm = useForm<InvoiceFormData>({
    resolver: zodResolver(insertVendorInvoiceSchema.omit({ vendorId: true, createdBy: true })),
    defaultValues: {
      invoiceDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  // Payment form
  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(insertVendorPaymentSchema.omit({ vendorId: true, createdBy: true })),
    defaultValues: {
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      paymentMethod: 'bank_transfer',
    },
  });

  // Add invoice mutation
  const addInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      let attachmentPath = null;
      
      // Upload file if provided
      if (invoiceFile) {
        setIsUploadingInvoice(true);
        const formData = new FormData();
        formData.append('file', invoiceFile);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload invoice file');
        }
        
        const uploadData = await uploadResponse.json();
        attachmentPath = uploadData.path;
        setIsUploadingInvoice(false);
      }
      
      return await apiRequest('POST', `/api/vendors/${selectedVendorId}/invoices`, {
        ...data,
        attachmentPath,
      });
    },
    onSuccess: () => {
      toast({
        title: "Invoice added",
        description: "The invoice has been successfully recorded.",
      });
      setAddInvoiceDialogOpen(false);
      setInvoiceFile(null);
      invoiceForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/vendors', selectedVendorId, 'invoices'] });
    },
    onError: (error) => {
      setIsUploadingInvoice(false);
      toast({
        variant: "destructive",
        title: "Failed to add invoice",
        description: error.message,
      });
    },
  });

  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      return await apiRequest('POST', `/api/vendors/${selectedVendorId}/payments`, data);
    },
    onSuccess: () => {
      toast({
        title: "Payment recorded",
        description: "The payment has been successfully recorded.",
      });
      setAddPaymentDialogOpen(false);
      paymentForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/vendors', selectedVendorId, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments/all'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to record payment",
        description: error.message,
      });
    },
  });

  // Edit invoice mutation
  const editInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      if (!editingInvoice) throw new Error("No invoice selected");
      
      let attachmentPath = editingInvoice.attachmentPath;
      
      // Upload new file if provided
      if (invoiceFile) {
        setIsUploadingInvoice(true);
        const formData = new FormData();
        formData.append('file', invoiceFile);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload invoice file');
        }
        
        const uploadData = await uploadResponse.json();
        attachmentPath = uploadData.path;
        setIsUploadingInvoice(false);
      }
      
      return await apiRequest('PUT', `/api/invoices/${editingInvoice.id}`, {
        ...data,
        attachmentPath,
      });
    },
    onSuccess: () => {
      toast({
        title: "Invoice updated",
        description: "The invoice has been successfully updated.",
      });
      handleCloseEditInvoice();
      queryClient.invalidateQueries({ queryKey: ['/api/vendors', selectedVendorId, 'invoices'] });
    },
    onError: (error) => {
      setIsUploadingInvoice(false);
      toast({
        variant: "destructive",
        title: "Failed to update invoice",
        description: error.message,
      });
    },
  });

  // Edit payment mutation
  const editPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      if (!editingPayment) throw new Error("No payment selected");
      return await apiRequest('PUT', `/api/payments/${editingPayment.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Payment updated",
        description: "The payment has been successfully updated.",
      });
      handleCloseEditPayment();
      queryClient.invalidateQueries({ queryKey: ['/api/vendors', selectedVendorId, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments/all'] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to update payment",
        description: error.message,
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'invoice' | 'payment' }) => {
      const endpoint = type === 'invoice' ? `/api/invoices/${id}` : `/api/payments/${id}`;
      return await apiRequest('DELETE', endpoint);
    },
    onSuccess: (_, variables) => {
      toast({
        title: `${variables.type === 'invoice' ? 'Invoice' : 'Payment'} deleted`,
        description: "The entry has been successfully deleted.",
      });
      setDeleteDialogOpen(false);
      setDeletingEntry(null);
      queryClient.invalidateQueries({ queryKey: ['/api/vendors', selectedVendorId, 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors', selectedVendorId, 'payments'] });
      if (variables.type === 'payment') {
        queryClient.invalidateQueries({ queryKey: ['/api/payments/all'] });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete",
        description: error.message,
      });
    },
  });

  // Handle edit actions
  const handleEditInvoice = (entry: LedgerEntry) => {
    const invoice = invoices.find(inv => inv.id === entry.id);
    if (invoice) {
      setEditingInvoice(invoice);
      invoiceForm.reset({
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        description: invoice.description,
        amount: invoice.amount,
        projectId: invoice.projectId || undefined,
      });
      setEditInvoiceDialogOpen(true);
    }
  };

  const handleEditPayment = (entry: LedgerEntry) => {
    const payment = payments.find(pay => pay.id === entry.id);
    if (payment) {
      setEditingPayment(payment);
      paymentForm.reset({
        paymentDate: payment.paymentDate,
        paymentReference: payment.paymentReference,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod as "cash" | "cheque" | "upi" | "bank_transfer",
        notes: payment.notes ?? undefined,
      });
      setEditPaymentDialogOpen(true);
    }
  };

  const handleDeleteEntry = (entry: LedgerEntry) => {
    setDeletingEntry({ id: entry.id, type: entry.type });
    setDeleteDialogOpen(true);
  };

  // Handle closing edit dialogs with cleanup
  const handleCloseEditInvoice = () => {
    setEditInvoiceDialogOpen(false);
    setEditingInvoice(null);
    setInvoiceFile(null);
    invoiceForm.reset({
      invoiceDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const handleCloseEditPayment = () => {
    setEditPaymentDialogOpen(false);
    setEditingPayment(null);
    paymentForm.reset({
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      paymentMethod: 'bank_transfer',
    });
  };

  // Calculate ledger entries with running balance
  const ledgerEntries: LedgerEntry[] = (() => {
    if (!selectedVendorId) return [];

    const entries: LedgerEntry[] = [];
    
    // Add invoices
    invoices.forEach((invoice) => {
      entries.push({
        id: invoice.id,
        date: new Date(invoice.invoiceDate),
        type: 'invoice',
        reference: invoice.invoiceNumber,
        description: invoice.description,
        debit: Number(invoice.amount),
        credit: 0,
        balance: 0, // Will be calculated
      });
    });

    // Add payments
    payments.forEach((payment) => {
      entries.push({
        id: payment.id,
        date: new Date(payment.paymentDate),
        type: 'payment',
        reference: payment.paymentReference,
        description: payment.notes || 'Payment',
        debit: 0,
        credit: Number(payment.amount),
        balance: 0, // Will be calculated
      });
    });

    // Sort by date (oldest first)
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance
    let runningBalance = 0;
    entries.forEach((entry) => {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    });

    return entries;
  })();

  // Calculate summary totals
  const totalInvoices = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalPayments = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
  const outstandingBalance = totalInvoices - totalPayments;

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  // Export ledger to Excel
  const handleExportLedger = () => {
    if (!selectedVendor || ledgerEntries.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot export",
        description: "No transactions to export",
      });
      return;
    }

    // Prepare data for Excel
    const exportData = ledgerEntries.map((entry) => ({
      Date: format(entry.date, 'dd-MMM-yyyy'),
      Type: entry.type === 'invoice' ? 'Invoice' : 'Payment',
      Reference: entry.reference,
      Description: entry.description,
      'Debit (₹)': entry.debit > 0 ? entry.debit.toFixed(2) : '',
      'Credit (₹)': entry.credit > 0 ? entry.credit.toFixed(2) : '',
      'Balance (₹)': entry.balance.toFixed(2),
    }));

    // Add summary rows
    exportData.push({
      Date: '',
      Type: '',
      Reference: '',
      Description: '',
      'Debit (₹)': '',
      'Credit (₹)': '',
      'Balance (₹)': '',
    });
    exportData.push({
      Date: '',
      Type: '',
      Reference: '',
      Description: 'Total Invoices',
      'Debit (₹)': totalInvoices.toFixed(2),
      'Credit (₹)': '',
      'Balance (₹)': '',
    });
    exportData.push({
      Date: '',
      Type: '',
      Reference: '',
      Description: 'Total Payments',
      'Debit (₹)': '',
      'Credit (₹)': totalPayments.toFixed(2),
      'Balance (₹)': '',
    });
    exportData.push({
      Date: '',
      Type: '',
      Reference: '',
      Description: 'Outstanding Balance',
      'Debit (₹)': '',
      'Credit (₹)': '',
      'Balance (₹)': outstandingBalance.toFixed(2),
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 10 }, // Type
      { wch: 15 }, // Reference
      { wch: 30 }, // Description
      { wch: 12 }, // Debit
      { wch: 12 }, // Credit
      { wch: 12 }, // Balance
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');

    // Generate filename with vendor name and date
    const filename = `${selectedVendor.name.replace(/[^a-z0-9]/gi, '_')}_Ledger_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    
    // Download file
    XLSX.writeFile(wb, filename);

    toast({
      title: "Ledger exported",
      description: `Downloaded as ${filename}`,
    });
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Vendor Accounts</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-page-description">
            Manage vendor invoices and payments
          </p>
        </div>
      </div>

      <Tabs defaultValue="ledger" className="space-y-3">
        <TabsList>
          <TabsTrigger value="ledger" data-testid="tab-vendor-ledger">Vendor Ledger</TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-payments-summary">Payments Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-3">
          {/* Vendor Selection */}
          <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">Select Vendor</CardTitle>
          <CardDescription className="text-sm">Choose a vendor to view their ledger</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
            <SelectTrigger data-testid="select-vendor">
              <SelectValue placeholder="Select a vendor..." />
            </SelectTrigger>
            <SelectContent>
              {vendors
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id} data-testid={`vendor-option-${vendor.id}`}>
                    {vendor.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedVendorId && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1.5">
                <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold" data-testid="text-total-invoices">
                  ₹{totalInvoices.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">{invoices.length} invoice(s)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1.5">
                <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold" data-testid="text-total-payments">
                  ₹{totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">{payments.length} payment(s)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1.5">
                <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div 
                  className={`text-xl font-bold ${outstandingBalance > 0 ? 'text-destructive' : 'text-green-600'}`}
                  data-testid="text-outstanding-balance"
                >
                  ₹{Math.abs(outstandingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {outstandingBalance > 0 ? 'Pending' : outstandingBalance < 0 ? 'Overpaid' : 'Settled'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          {!canManageAccounts && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have read-only access to vendor accounts. Only administrators and designers can add invoices or record payments.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            {canManageAccounts && (
              <>
                <Dialog open={addInvoiceDialogOpen} onOpenChange={(open) => {
              if (!open) {
                setInvoiceFile(null);
                invoiceForm.reset({
                  invoiceDate: format(new Date(), 'yyyy-MM-dd'),
                });
              }
              setAddInvoiceDialogOpen(open);
            }}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-invoice">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Invoice</DialogTitle>
                  <DialogDescription>
                    Record a new invoice for {selectedVendor?.name}
                  </DialogDescription>
                </DialogHeader>
                <Form {...invoiceForm}>
                  <form onSubmit={invoiceForm.handleSubmit((data) => addInvoiceMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={invoiceForm.control}
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="INV-001" data-testid="input-invoice-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="invoiceDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-invoice-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="select-invoice-project">
                                <SelectValue placeholder="None (not linked to project)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.projectName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Description of work/items" data-testid="input-invoice-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₹)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              data-testid="input-invoice-amount"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label>Invoice Attachment (Optional)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                          data-testid="input-invoice-file"
                        />
                      </div>
                      {invoiceFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {invoiceFile.name}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => {
                        setInvoiceFile(null);
                        invoiceForm.reset({
                          invoiceDate: format(new Date(), 'yyyy-MM-dd'),
                        });
                        setAddInvoiceDialogOpen(false);
                      }}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addInvoiceMutation.isPending || isUploadingInvoice} data-testid="button-submit-invoice">
                        {isUploadingInvoice ? "Uploading..." : addInvoiceMutation.isPending ? "Adding..." : "Add Invoice"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={addPaymentDialogOpen} onOpenChange={setAddPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-record-payment">
                  <Banknote className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                  <DialogDescription>
                    Record a payment made to {selectedVendor?.name}
                  </DialogDescription>
                </DialogHeader>
                <Form {...paymentForm}>
                  <form onSubmit={paymentForm.handleSubmit((data) => addPaymentMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={paymentForm.control}
                      name="paymentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-payment-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="paymentReference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Reference</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="PMT-001 or Transaction ID" data-testid="input-payment-reference" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₹)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              data-testid="input-payment-amount"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-payment-method">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                              <SelectItem value="upi">UPI</SelectItem>
                              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value ?? ''} placeholder="Additional notes" data-testid="input-payment-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setAddPaymentDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addPaymentMutation.isPending} data-testid="button-submit-payment">
                        {addPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Edit Invoice Dialog */}
            <Dialog open={editInvoiceDialogOpen} onOpenChange={(open) => !open && handleCloseEditInvoice()}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Invoice</DialogTitle>
                  <DialogDescription>
                    Update invoice details for {selectedVendor?.name}
                  </DialogDescription>
                </DialogHeader>
                <Form {...invoiceForm}>
                  <form onSubmit={invoiceForm.handleSubmit((data) => editInvoiceMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={invoiceForm.control}
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="INV-001" data-testid="input-edit-invoice-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="invoiceDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-edit-invoice-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Invoice description" data-testid="input-edit-invoice-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={invoiceForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₹)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-edit-invoice-amount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label>Invoice Attachment</Label>
                      {editingInvoice?.attachmentPath && !invoiceFile && (
                        <div className="flex items-center gap-2 p-2 border rounded">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm flex-1">Current attachment</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(editingInvoice.attachmentPath!, '_blank')}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                          data-testid="input-edit-invoice-file"
                        />
                      </div>
                      {invoiceFile && (
                        <p className="text-sm text-muted-foreground">
                          New file: {invoiceFile.name}
                        </p>
                      )}
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={handleCloseEditInvoice}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={editInvoiceMutation.isPending || isUploadingInvoice} data-testid="button-submit-edit-invoice">
                        {isUploadingInvoice ? "Uploading..." : editInvoiceMutation.isPending ? "Updating..." : "Update Invoice"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Edit Payment Dialog */}
            <Dialog open={editPaymentDialogOpen} onOpenChange={(open) => !open && handleCloseEditPayment()}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Payment</DialogTitle>
                  <DialogDescription>
                    Update payment details for {selectedVendor?.name}
                  </DialogDescription>
                </DialogHeader>
                <Form {...paymentForm}>
                  <form onSubmit={paymentForm.handleSubmit((data) => editPaymentMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={paymentForm.control}
                      name="paymentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-edit-payment-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="paymentReference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Reference</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="PMT-001" data-testid="input-edit-payment-reference" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₹)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-edit-payment-amount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} data-testid="select-edit-payment-method">
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                              <SelectItem value="upi">UPI</SelectItem>
                              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value ?? ''} placeholder="Additional notes" data-testid="input-edit-payment-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={handleCloseEditPayment}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={editPaymentMutation.isPending} data-testid="button-submit-edit-payment">
                        {editPaymentMutation.isPending ? "Updating..." : "Update Payment"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this {deletingEntry?.type === 'invoice' ? 'invoice' : 'payment'}. 
                    This action cannot be undone and will affect the vendor's balance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletingEntry && deleteMutation.mutate(deletingEntry)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

                <Button 
                  variant="outline" 
                  onClick={handleExportLedger}
                  disabled={!selectedVendorId || ledgerEntries.length === 0}
                  data-testid="button-export-ledger"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Ledger
                </Button>
              </>
            )}
          </div>

          {/* Ledger Table */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor Ledger - {selectedVendor?.name}</CardTitle>
              <CardDescription>All invoices and payments in chronological order</CardDescription>
            </CardHeader>
            <CardContent>
              {ledgerEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions recorded yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="w-24">Attachment</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit (₹)</TableHead>
                      <TableHead className="text-right">Credit (₹)</TableHead>
                      <TableHead className="text-right">Balance (₹)</TableHead>
                      {canManageAccounts && <TableHead className="w-12"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries.map((entry) => (
                      <TableRow key={entry.id} data-testid={`ledger-row-${entry.id}`}>
                        <TableCell>{format(entry.date, 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <span className={entry.type === 'invoice' ? 'text-destructive' : 'text-green-600'}>
                            {entry.type === 'invoice' ? 'Invoice' : 'Payment'}
                          </span>
                        </TableCell>
                        <TableCell>{entry.reference}</TableCell>
                        <TableCell>
                          {entry.type === 'invoice' && invoices.find(inv => inv.id === entry.id)?.attachmentPath ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const invoice = invoices.find(inv => inv.id === entry.id);
                                if (invoice?.attachmentPath) {
                                  window.open(invoice.attachmentPath, '_blank');
                                }
                              }}
                              data-testid={`button-view-invoice-${entry.id}`}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              View PDF
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right">
                          {entry.debit > 0 ? entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.credit > 0 ? entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${entry.balance > 0 ? 'text-destructive' : entry.balance < 0 ? 'text-green-600' : ''}`}>
                          {entry.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        {canManageAccounts && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-actions-${entry.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => entry.type === 'invoice' ? handleEditInvoice(entry) : handleEditPayment(entry)}
                                  data-testid={`button-edit-${entry.id}`}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteEntry(entry)}
                                  data-testid={`button-delete-${entry.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
        </TabsContent>

        <TabsContent value="summary" className="space-y-3">
          <PaymentsSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentsSummary() {
  const { toast } = useToast();
  const [openVendors, setOpenVendors] = useState<Set<string>>(new Set());

  // Fetch all payments with vendor information
  const { data: allPayments = [], isLoading } = useQuery<Array<VendorPayment & { vendorName: string }>>({
    queryKey: ['/api/payments/all'],
  });

  // Group payments by vendor
  const vendorPayments = allPayments.reduce((acc, payment) => {
    if (!acc[payment.vendorId]) {
      acc[payment.vendorId] = {
        vendorName: payment.vendorName,
        payments: [],
        total: 0,
      };
    }
    acc[payment.vendorId].payments.push(payment);
    acc[payment.vendorId].total += Number(payment.amount);
    return acc;
  }, {} as Record<string, { vendorName: string; payments: Array<VendorPayment & { vendorName: string }>; total: number }>);

  // Convert to array and sort by total amount (descending)
  const sortedVendors = Object.entries(vendorPayments).sort((a, b) => b[1].total - a[1].total);

  // Calculate totals
  const totalPayments = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalVendors = sortedVendors.length;
  const totalTransactions = allPayments.length;

  const toggleVendor = (vendorId: string) => {
    setOpenVendors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vendorId)) {
        newSet.delete(vendorId);
      } else {
        newSet.add(vendorId);
      }
      return newSet;
    });
  };

  const handleExportAll = () => {
    if (allPayments.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot export",
        description: "No payment data to export",
      });
      return;
    }

    // Prepare data for Excel
    const exportData = allPayments.map((payment) => ({
      Vendor: payment.vendorName,
      Date: format(new Date(payment.paymentDate), 'dd-MMM-yyyy'),
      Reference: payment.paymentReference,
      'Amount (₹)': Number(payment.amount).toFixed(2),
      Method: payment.paymentMethod,
      Notes: payment.notes || '',
    }));

    // Add summary row
    exportData.push({
      Vendor: '',
      Date: '',
      Reference: '',
      'Amount (₹)': '',
      Method: '',
      Notes: '',
    });
    exportData.push({
      Vendor: 'Total Payments',
      Date: '',
      Reference: '',
      'Amount (₹)': totalPayments.toFixed(2),
      Method: '',
      Notes: '',
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Vendor
      { wch: 12 }, // Date
      { wch: 15 }, // Reference
      { wch: 12 }, // Amount
      { wch: 15 }, // Method
      { wch: 30 }, // Notes
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'All Payments');

    // Generate filename
    const filename = `All_Payments_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    
    // Download file
    XLSX.writeFile(wb, filename);

    toast({
      title: "Payments exported",
      description: `Downloaded as ${filename}`,
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading payment data...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Summary Cards and Export */}
      <div className="flex items-end justify-between gap-3">
        <div className="grid gap-3 md:grid-cols-2 flex-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1.5">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold" data-testid="text-summary-total-payments">
                ₹{totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">{totalTransactions} transaction(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 pb-1.5">
              <CardTitle className="text-sm font-medium">Active Vendors</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold" data-testid="text-summary-vendor-count">
                {totalVendors}
              </div>
              <p className="text-xs text-muted-foreground">Vendors with payments</p>
            </CardContent>
          </Card>
        </div>

        {/* Export Button */}
        <Button onClick={handleExportAll} variant="outline" size="sm" data-testid="button-export-all-payments">
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Vendor Sections */}
      {sortedVendors.length === 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="text-center text-muted-foreground">
              <Banknote className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No payment records found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedVendors.map(([vendorId, { vendorName, payments, total }]) => {
            const isOpen = openVendors.has(vendorId);
            
            return (
              <Card key={vendorId}>
                <Collapsible open={isOpen} onOpenChange={() => toggleVendor(vendorId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover-elevate p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <CardTitle className="text-base" data-testid={`text-vendor-${vendorId}`}>
                              {vendorName}
                            </CardTitle>
                            <CardDescription className="text-sm">
                              {payments.length} payment(s)
                            </CardDescription>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold" data-testid={`text-vendor-total-${vendorId}`}>
                            ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <p className="text-xs text-muted-foreground">Total paid</p>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-3 pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                              <TableCell>{format(new Date(payment.paymentDate), 'dd-MMM-yyyy')}</TableCell>
                              <TableCell>{payment.paymentReference}</TableCell>
                              <TableCell className="capitalize">{payment.paymentMethod.replace('_', ' ')}</TableCell>
                              <TableCell className="text-muted-foreground">{payment.notes || '-'}</TableCell>
                              <TableCell className="text-right font-semibold">
                                ₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
