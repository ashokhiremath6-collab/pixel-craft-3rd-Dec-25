import { FileViewerModal } from "@/components/FileViewerModal";
import { useState } from "react";
import { sortProjectsForDropdown } from "@/lib/projectSort";
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
import { Plus, FileText, Banknote, TrendingUp, Download, AlertCircle, IndianRupee, Edit, Trash2, MoreVertical, Upload, Eye, ChevronDown, ChevronRight, SendHorizonal, Building2, CreditCard, CheckCircle2, Clock, Archive } from "lucide-react";
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
import type { Vendor, VendorInvoice, VendorPayment, Project, PaymentRequest } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

const INDIAN_BANKS = [
  "State Bank of India (SBI)",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank (PNB)",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IndusInd Bank",
  "Yes Bank",
  "IDFC First Bank",
  "Bank of India",
  "Indian Bank",
  "Central Bank of India",
  "Federal Bank",
  "RBL Bank",
  "South Indian Bank",
  "Karnataka Bank",
  "DCB Bank",
  "Standard Chartered Bank",
  "HSBC Bank",
  "Citibank",
];

function BankNameField({ field }: { field: any }) {
  const isKnown = INDIAN_BANKS.includes(field.value || "");
  const [showOther, setShowOther] = useState(!isKnown && !!field.value);

  return (
    <div className="space-y-2">
      <Select
        value={showOther ? "__other__" : (field.value || "")}
        onValueChange={(v) => {
          if (v === "__other__") {
            setShowOther(true);
            field.onChange("");
          } else {
            setShowOther(false);
            field.onChange(v);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a bank" />
        </SelectTrigger>
        <SelectContent>
          {INDIAN_BANKS.map((b) => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
          ))}
          <SelectItem value="__other__">Other (type manually)</SelectItem>
        </SelectContent>
      </Select>
      {showOther && (
        <Input
          placeholder="Type bank name"
          value={field.value || ""}
          onChange={(e) => field.onChange(e.target.value)}
        />
      )}
    </div>
  );
}

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

interface PaymentRequestRow {
  id: string;
  vendorId: string;
  vendorName: string;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  branch?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  invoiceValue?: string | null;
  amount: string;
  description: string;
  remarks?: string | null;
  status: string;
  requestedAt: string;
  clientPaidAt?: string | null;
  clientUtr?: string | null;
  confirmedAt?: string | null;
}

const paymentRequestFormSchema = z.object({
  vendorId: z.string().min(1, "Select a vendor"),
  projectId: z.string().min(1, "Select a project"),
  invoiceValue: z.coerce.number().positive("Must be greater than 0").optional().or(z.literal("")).transform(v => v === "" ? undefined : v),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  remarks: z.string().optional(),
});
type PaymentRequestFormData = z.infer<typeof paymentRequestFormSchema>;

const bankDetailsSchema = z.object({
  bankName: z.string().optional(),
  accountHolderName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  branch: z.string().optional(),
});
type BankDetailsFormData = z.infer<typeof bankDetailsSchema>;

export default function AccountsPage() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerFileName, setViewerFileName] = useState("");
  const openInViewer = (url: string, name?: string) => {
    setViewerUrl(url);
    setViewerFileName(name || "");
    setViewerOpen(true);
  };
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [addInvoiceDialogOpen, setAddInvoiceDialogOpen] = useState(false);
  const [addPaymentDialogOpen, setAddPaymentDialogOpen] = useState(false);
  const [requestPaymentOpen, setRequestPaymentOpen] = useState(false);
  const [bankDetailsOpen, setBankDetailsOpen] = useState(false);
  const [bankDetailsVendorId, setBankDetailsVendorId] = useState<string>("");
  const [prSaveDialog, setPrSaveDialog] = useState<PaymentRequestRow | null>(null);
  const [prSaveDate, setPrSaveDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [prSaveNotes, setPrSaveNotes] = useState("");
  const [editInvoiceDialogOpen, setEditInvoiceDialogOpen] = useState(false);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<VendorInvoice | null>(null);
  const [editingPayment, setEditingPayment] = useState<VendorPayment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<{ id: string; type: 'invoice' | 'payment' } | null>(null);
  const [deletePrDialogOpen, setDeletePrDialogOpen] = useState(false);
  const [deletingPr, setDeletingPr] = useState<PaymentRequestRow | null>(null);
  const [addLedgerDialog, setAddLedgerDialog] = useState<PaymentRequestRow | null>(null);
  const [addLedgerDate, setAddLedgerDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [addLedgerNotes, setAddLedgerNotes] = useState("");
  const [directConfirmDialog, setDirectConfirmDialog] = useState<PaymentRequestRow | null>(null);
  const [directConfirmDate, setDirectConfirmDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [directConfirmUtr, setDirectConfirmUtr] = useState("");
  const [directConfirmNotes, setDirectConfirmNotes] = useState("");
  const [requestsTabVendorId, setRequestsTabVendorId] = useState<string>("");
  const [paymentRequestVendorId, setPaymentRequestVendorId] = useState<string>("");
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

  // Fetch payment requests (all)
  const { data: paymentRequestsList = [] } = useQuery<PaymentRequestRow[]>({
    queryKey: ['/api/payment-requests'],
    enabled: canManageAccounts,
  });

  // Split into recent (last 7 days or not yet confirmed) vs history (confirmed + older than 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentRequests = paymentRequestsList.filter(pr =>
    pr.status !== 'confirmed' || new Date(pr.requestedAt) >= sevenDaysAgo
  );
  const historyRequests = paymentRequestsList.filter(pr =>
    pr.status === 'confirmed' && new Date(pr.requestedAt) < sevenDaysAgo
  );

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
      projectId: undefined,
    },
  });

  // Payment Request form
  const paymentRequestForm = useForm<PaymentRequestFormData>({
    resolver: zodResolver(paymentRequestFormSchema),
    defaultValues: {
      vendorId: selectedVendorId || "",
      projectId: "",
      invoiceValue: undefined,
      description: "",
      remarks: "",
    },
  });

  // Bank details form
  const bankDetailsForm = useForm<BankDetailsFormData>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: {},
  });

  // Create payment request mutation
  const createPaymentRequestMutation = useMutation({
    mutationFn: (data: PaymentRequestFormData) =>
      apiRequest('POST', '/api/payment-requests', data),
    onSuccess: () => {
      toast({ title: "Payment request sent", description: "An email has been sent to the client with bank details." });
      setRequestPaymentOpen(false);
      paymentRequestForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
    },
    onError: async (error: any) => {
      let msg = "An error occurred.";
      try { const j = await error?.response?.json?.(); if (j?.error) msg = j.error; } catch {}
      toast({ variant: "destructive", title: "Failed to send request", description: msg });
    },
  });

  // Delete payment request mutation
  const deletePaymentRequestMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/payment-requests/${id}`),
    onSuccess: () => {
      toast({ title: "Payment request deleted" });
      setDeletePrDialogOpen(false);
      setDeletingPr(null);
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/payment-alerts'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to delete payment request" });
    },
  });

  // Cancel payment request mutation
  const cancelPaymentRequestMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/payment-requests/${id}/cancel`, {}),
    onSuccess: () => {
      toast({ title: "Payment request cancelled" });
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/payment-alerts'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to cancel payment request" });
    },
  });

  // Save bank details mutation
  const saveBankDetailsMutation = useMutation({
    mutationFn: (data: BankDetailsFormData) =>
      apiRequest('PATCH', `/api/vendors/${bankDetailsVendorId}`, data),
    onSuccess: () => {
      toast({ title: "Bank details saved" });
      setBankDetailsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to save bank details" });
    },
  });

  // Save to Accounts: confirm the payment request (backend atomically creates the ledger entry)
  const saveToAccountsMutation = useMutation({
    mutationFn: async ({ pr, date, notes }: { pr: PaymentRequestRow; date: string; notes: string }) => {
      await apiRequest('PATCH', `/api/payment-requests/${pr.id}/confirm`, {
        paymentDate: date,
        notes: notes || `Payment received from client. UTR: ${pr.clientUtr || "N/A"}. ${pr.description}`,
      });
    },
    onSuccess: () => {
      toast({ title: "Saved to accounts and confirmed" });
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/payment-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      if (prSaveDialog) queryClient.invalidateQueries({ queryKey: ['/api/vendors', prSaveDialog.vendorId, 'payments'] });
      setPrSaveDialog(null);
      setPrSaveNotes("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to save to accounts" });
    },
  });

  // Add to Ledger: retroactively create a payment entry for an already-confirmed payment request
  const addToLedgerMutation = useMutation({
    mutationFn: async ({ pr, date, notes }: { pr: PaymentRequestRow; date: string; notes: string }) => {
      await apiRequest('POST', `/api/vendors/${pr.vendorId}/payments`, {
        paymentDate: date,
        amount: String(pr.amount),
        paymentMethod: 'bank_transfer',
        paymentReference: pr.clientUtr || `PR-${pr.id.substring(0, 8).toUpperCase()}`,
        notes: notes || `Payment received from client. UTR: ${pr.clientUtr || "N/A"}. ${pr.description}`,
      });
    },
    onSuccess: () => {
      toast({ title: "Added to ledger", description: "Payment entry has been recorded in the vendor ledger." });
      setAddLedgerDialog(null);
      setAddLedgerNotes("");
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      if (addLedgerDialog) queryClient.invalidateQueries({ queryKey: ['/api/vendors', addLedgerDialog.vendorId, 'payments'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to add to ledger" });
    },
  });

  // Direct confirm: designer marks pending/acknowledged request as paid and saves to ledger in one step
  const directConfirmMutation = useMutation({
    mutationFn: async ({ pr, date, utr, notes }: { pr: PaymentRequestRow; date: string; utr: string; notes: string }) => {
      await apiRequest('PATCH', `/api/payment-requests/${pr.id}/direct-confirm`, {
        paymentDate: date,
        utr: utr || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Payment confirmed and saved to accounts" });
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/payment-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      if (directConfirmDialog) queryClient.invalidateQueries({ queryKey: ['/api/vendors', directConfirmDialog.vendorId, 'payments'] });
      setDirectConfirmDialog(null);
      setDirectConfirmUtr("");
      setDirectConfirmNotes("");
    },
    onError: () => toast({ variant: "destructive", title: "Failed to confirm payment" }),
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
        projectId: (payment as any).projectId ?? undefined,
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
          {canManageAccounts && (
            <TabsTrigger value="requests">
              Payment Requests
              {recentRequests.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                  {recentRequests.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {canManageAccounts && historyRequests.length > 0 && (
            <TabsTrigger value="history">
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              History
            </TabsTrigger>
          )}
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
          <div className="flex gap-2 flex-wrap">
            {canManageAccounts && (
              <>
                {/* Request Payment Button */}
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentRequestVendorId(selectedVendorId || "");
                    paymentRequestForm.reset({ vendorId: selectedVendorId || "", projectId: "", description: "" });
                    setRequestPaymentOpen(true);
                  }}
                >
                  <SendHorizonal className="h-4 w-4 mr-2" />
                  Request Payment
                </Button>

                {/* Edit Bank Details Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const v = vendors.find(x => x.id === selectedVendorId);
                    setBankDetailsVendorId(selectedVendorId);
                    bankDetailsForm.reset({
                      bankName: (v as any)?.bankName || "",
                      accountHolderName: (v as any)?.accountHolderName || "",
                      accountNumber: (v as any)?.accountNumber || "",
                      ifscCode: (v as any)?.ifscCode || "",
                      branch: (v as any)?.branch || "",
                    });
                    setBankDetailsOpen(true);
                  }}
                >
                  <Building2 className="h-4 w-4 mr-1.5" />
                  Bank Details
                </Button>

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
                  <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                              {sortProjectsForDropdown(projects).map((project) => (
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
              <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project (Optional)</FormLabel>
                          <Select onValueChange={v => field.onChange(v === "__none__" ? undefined : v)} value={field.value ?? "__none__"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="No project" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">No project</SelectItem>
                              {projects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
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
              <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                            size="icon"
                            onClick={() => openInViewer(`/api/invoices/${editingInvoice.id}/attachment`, (editingInvoice.invoiceNumber || 'invoice') + '.pdf')}
                          >
                            <Eye className="h-4 w-4" />
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
              <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project (Optional)</FormLabel>
                          <Select onValueChange={v => field.onChange(v === "__none__" ? undefined : v)} value={field.value ?? "__none__"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="No project" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">No project</SelectItem>
                              {projects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
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
                <Table className="table-fixed">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[20%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    {canManageAccounts && <col className="w-[5%]" />}
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Attachment</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit (₹)</TableHead>
                      <TableHead className="text-right">Credit (₹)</TableHead>
                      <TableHead className="text-right">Balance (₹)</TableHead>
                      {canManageAccounts && <TableHead className="text-right"></TableHead>}
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
                                  openInViewer(`/api/invoices/${invoice.id}/attachment`, (invoice.invoiceNumber || 'invoice') + '.pdf');
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

        {canManageAccounts && (
          <TabsContent value="requests" className="space-y-3">
            {/* Vendor picker + action */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">New Payment Request</CardTitle>
                <CardDescription>Select a vendor then click "Request Payment" to send a payment request to the client.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <Select value={requestsTabVendorId} onValueChange={setRequestsTabVendorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  disabled={!requestsTabVendorId}
                  onClick={() => {
                    setPaymentRequestVendorId(requestsTabVendorId);
                    paymentRequestForm.reset({ vendorId: requestsTabVendorId, projectId: "", description: "" } as any);
                    setRequestPaymentOpen(true);
                  }}
                >
                  <SendHorizonal className="h-4 w-4 mr-2" />
                  Request Payment
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Requests
                </CardTitle>
                <CardDescription>All payment requests sent to clients. Track status and confirm once the client marks as paid.</CardDescription>
              </CardHeader>
              <CardContent>
                {recentRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No payment requests yet. Select a vendor above and click "Request Payment" to get started.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentRequests.map(pr => {
                      const statusColor = pr.status === 'confirmed'
                        ? { bg: '#dcfce7', text: '#166534' }
                        : pr.status === 'client_paid'
                        ? { bg: '#fff7ed', text: '#c2410c' }
                        : pr.status === 'acknowledged'
                        ? { bg: '#fef9c3', text: '#854d0e' }
                        : { bg: '#eff6ff', text: '#1d4ed8' };
                      const statusLabel = pr.status === 'confirmed' ? 'Confirmed' : pr.status === 'client_paid' ? 'Payment Made' : pr.status === 'acknowledged' ? 'Acknowledged' : 'Pending';
                      return (
                        <div key={pr.id} className="flex items-start justify-between gap-4 p-4 rounded-md border">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{pr.vendorName}</span>
                              {pr.projectName && (
                                <span className="text-xs text-muted-foreground">· {pr.projectName}</span>
                              )}
                              <span
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: statusColor.bg, color: statusColor.text }}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{pr.description}</p>
                            {pr.remarks && (
                              <p className="text-xs text-muted-foreground italic">{pr.remarks}</p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                              {pr.invoiceValue && (
                                <span>Invoice: <span className="font-medium text-foreground">₹{Number(pr.invoiceValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                              )}
                              <span className="font-semibold text-foreground">
                                To pay: ₹{Number(pr.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                              <span>Requested {format(new Date(pr.requestedAt), 'dd MMM yyyy')}</span>
                              {pr.clientPaidAt && (
                                <span className="text-orange-700">Paid {format(new Date(pr.clientPaidAt), 'dd MMM yyyy')}</span>
                              )}
                              {pr.clientUtr && (
                                <span>UTR: <span className="font-mono">{pr.clientUtr}</span></span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {pr.status === 'client_paid' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setPrSaveDialog(pr);
                                  setPrSaveDate(pr.clientPaidAt ? format(new Date(pr.clientPaidAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                                  setPrSaveNotes("");
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                Save to Accounts
                              </Button>
                            )}
                            {pr.status === 'confirmed' && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setAddLedgerDialog(pr);
                                    setAddLedgerDate(pr.clientPaidAt ? format(new Date(pr.clientPaidAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                                    setAddLedgerNotes("");
                                  }}
                                >
                                  <IndianRupee className="h-4 w-4 mr-1.5" />
                                  Add to Ledger
                                </Button>
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              </div>
                            )}
                            {(pr.status === 'pending' || pr.status === 'acknowledged') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setDirectConfirmDialog(pr);
                                  setDirectConfirmDate(format(new Date(), 'yyyy-MM-dd'));
                                  setDirectConfirmUtr("");
                                  setDirectConfirmNotes("");
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                Mark as Paid
                              </Button>
                            )}
                            {pr.status !== 'confirmed' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="text-muted-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => { setDeletingPr(pr); setDeletePrDialogOpen(true); }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canManageAccounts && historyRequests.length > 0 && (
          <TabsContent value="history" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Payment Request History
                </CardTitle>
                <CardDescription>
                  Confirmed payment requests older than 7 days. {historyRequests.length} record{historyRequests.length !== 1 ? 's' : ''}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {historyRequests.map(pr => (
                    <div key={pr.id} className="flex items-start justify-between gap-4 p-4 rounded-md border">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{pr.vendorName}</span>
                          {pr.projectName && (
                            <span className="text-xs text-muted-foreground">· {pr.projectName}</span>
                          )}
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}>
                            Confirmed
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{pr.description}</p>
                        {pr.remarks && (
                          <p className="text-xs text-muted-foreground italic">{pr.remarks}</p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                          {pr.invoiceValue && (
                            <span>Invoice: <span className="font-medium text-foreground">₹{Number(pr.invoiceValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                          )}
                          <span className="font-semibold text-foreground">
                            ₹{Number(pr.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span>Requested {format(new Date(pr.requestedAt), 'dd MMM yyyy')}</span>
                          {pr.clientPaidAt && (
                            <span>Paid {format(new Date(pr.clientPaidAt), 'dd MMM yyyy')}</span>
                          )}
                          {pr.clientUtr && (
                            <span>UTR: <span className="font-mono">{pr.clientUtr}</span></span>
                          )}
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Request Payment Dialog (outside Tabs so it renders on any tab) ── */}
      <Dialog open={requestPaymentOpen} onOpenChange={setRequestPaymentOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Payment from Client</DialogTitle>
            <DialogDescription>Send a payment request to the client for a vendor payment. They will receive an email with bank details.</DialogDescription>
          </DialogHeader>
          <Form {...paymentRequestForm}>
            <form onSubmit={paymentRequestForm.handleSubmit(d => createPaymentRequestMutation.mutate(d))} className="space-y-4">
              {(() => {
                const v = vendors.find(x => x.id === paymentRequestVendorId);
                if (!v) return null;
                const hasBankDetails = (v as any).bankName || (v as any).accountNumber || (v as any).ifscCode;
                if (!hasBankDetails) {
                  return (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{v.name}</strong> has no bank details on file. The client will not know where to transfer the money.
                        <br />
                        <span className="text-sm">Close this dialog and click <strong>"Bank Details"</strong> next to the vendor to add account number, IFSC and bank name first.</span>
                      </AlertDescription>
                    </Alert>
                  );
                }
                return (
                  <div className="rounded-md border bg-muted/40 px-3 py-2.5 space-y-1 text-xs">
                    <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Vendor — bank details that will be sent to client</p>
                    <p className="font-medium text-sm">{v.name}</p>
                    {(v as any).bankName && <p><span className="text-muted-foreground">Bank:</span> {(v as any).bankName}{(v as any).branch ? ` — ${(v as any).branch}` : ""}</p>}
                    {(v as any).accountHolderName && <p><span className="text-muted-foreground">Account Holder:</span> {(v as any).accountHolderName}</p>}
                    {(v as any).accountNumber && <p><span className="text-muted-foreground">Account:</span> {(v as any).accountNumber}</p>}
                    {(v as any).ifscCode && <p><span className="text-muted-foreground">IFSC:</span> {(v as any).ifscCode}</p>}
                  </div>
                );
              })()}
              <FormField
                control={paymentRequestForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger><SelectValue placeholder="Select project (required)" /></SelectTrigger>
                      <SelectContent>
                        {sortProjectsForDropdown(projects).map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={paymentRequestForm.control}
                  name="invoiceValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Value (₹)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentRequestForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount to be Paid (₹)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={paymentRequestForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Payment for furniture supply — Phase 1" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentRequestForm.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Any additional notes or instructions" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRequestPaymentOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPaymentRequestMutation.isPending}>
                  <SendHorizonal className="h-4 w-4 mr-2" />
                  {createPaymentRequestMutation.isPending ? "Sending..." : "Send Request"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Bank Details Dialog (outside Tabs so it renders on any tab) ── */}
      <Dialog open={bankDetailsOpen} onOpenChange={setBankDetailsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bank Details</DialogTitle>
            <DialogDescription>
              Set the bank account details for {vendors.find(v => v.id === bankDetailsVendorId)?.name || "this vendor"}. These are shown to clients in payment request emails.
            </DialogDescription>
          </DialogHeader>
          <Form {...bankDetailsForm}>
            <form onSubmit={bankDetailsForm.handleSubmit(d => saveBankDetailsMutation.mutate(d))} className="space-y-4">
              <FormField control={bankDetailsForm.control} name="bankName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl><BankNameField field={field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={bankDetailsForm.control} name="accountHolderName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Holder Name</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. Rajesh Kumar" /></FormControl>
                </FormItem>
              )} />
              <FormField control={bankDetailsForm.control} name="accountNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Number</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} placeholder="1234567890" /></FormControl>
                </FormItem>
              )} />
              <FormField control={bankDetailsForm.control} name="ifscCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>IFSC Code</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} placeholder="HDFC0001234" /></FormControl>
                </FormItem>
              )} />
              <FormField control={bankDetailsForm.control} name="branch" render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} placeholder="Koramangala, Bengaluru" /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBankDetailsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveBankDetailsMutation.isPending}>
                  {saveBankDetailsMutation.isPending ? "Saving..." : "Save Details"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <FileViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        fileUrl={viewerUrl}
        fileName={viewerFileName}
      />

      {/* Delete Payment Request confirmation dialog */}
      <AlertDialog open={deletePrDialogOpen} onOpenChange={setDeletePrDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the payment request
              {deletingPr ? ` for ${deletingPr.vendorName} (₹${Number(deletingPr.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })})` : ''}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingPr(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPr && deletePaymentRequestMutation.mutate(deletingPr.id)}
              disabled={deletePaymentRequestMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save to Accounts dialog for Payment Requests tab */}
      {prSaveDialog && (
        <Dialog open={!!prSaveDialog} onOpenChange={open => !open && setPrSaveDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Save to Accounts</DialogTitle>
              <DialogDescription>
                Record this payment in the vendor ledger for <strong>{prSaveDialog.vendorName}</strong> and mark the request as confirmed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-base">
                  ₹{Number(prSaveDialog.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {prSaveDialog.clientUtr && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">UTR / Reference</span>
                  <span className="font-mono">{prSaveDialog.clientUtr}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="pr-save-date">Payment Date</Label>
                <Input
                  id="pr-save-date"
                  type="date"
                  value={prSaveDate}
                  onChange={e => setPrSaveDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-save-notes">Notes (optional)</Label>
                <Input
                  id="pr-save-notes"
                  value={prSaveNotes}
                  onChange={e => setPrSaveNotes(e.target.value)}
                  placeholder="Additional notes for the ledger entry"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPrSaveDialog(null)}>Cancel</Button>
              <Button
                onClick={() => saveToAccountsMutation.mutate({ pr: prSaveDialog, date: prSaveDate, notes: prSaveNotes })}
                disabled={saveToAccountsMutation.isPending}
              >
                {saveToAccountsMutation.isPending ? "Saving..." : "Save to Accounts"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add to Ledger dialog for already-confirmed payment requests */}
      {addLedgerDialog && (
        <Dialog open={!!addLedgerDialog} onOpenChange={open => !open && setAddLedgerDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add to Ledger</DialogTitle>
              <DialogDescription>
                Record the payment from <strong>{addLedgerDialog.vendorName}</strong> in the vendor ledger.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-base">
                  ₹{Number(addLedgerDialog.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {addLedgerDialog.clientUtr && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">UTR / Reference</span>
                  <span className="font-mono">{addLedgerDialog.clientUtr}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="add-ledger-date">Payment Date</Label>
                <Input
                  id="add-ledger-date"
                  type="date"
                  value={addLedgerDate}
                  onChange={e => setAddLedgerDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-ledger-notes">Notes (optional)</Label>
                <Input
                  id="add-ledger-notes"
                  value={addLedgerNotes}
                  onChange={e => setAddLedgerNotes(e.target.value)}
                  placeholder="Additional notes for the ledger entry"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddLedgerDialog(null)}>Cancel</Button>
              <Button
                onClick={() => addToLedgerMutation.mutate({ pr: addLedgerDialog, date: addLedgerDate, notes: addLedgerNotes })}
                disabled={addToLedgerMutation.isPending}
              >
                {addToLedgerMutation.isPending ? "Adding..." : "Add to Ledger"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mark as Paid: designer directly confirms a pending/acknowledged request */}
      {directConfirmDialog && (
        <Dialog open={!!directConfirmDialog} onOpenChange={open => !open && setDirectConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Paid & Save to Accounts</DialogTitle>
              <DialogDescription>
                Record this payment directly in the vendor ledger for <strong>{directConfirmDialog.vendorName}</strong>. Use this when the client has forwarded the payment advice without going through the portal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">₹{Number(directConfirmDialog.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Description</span>
                <span className="text-right max-w-[60%]">{directConfirmDialog.description}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direct-confirm-date">Payment Date</Label>
                <Input
                  id="direct-confirm-date"
                  type="date"
                  value={directConfirmDate}
                  onChange={e => setDirectConfirmDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direct-confirm-utr">UTR / Reference Number (optional)</Label>
                <Input
                  id="direct-confirm-utr"
                  value={directConfirmUtr}
                  onChange={e => setDirectConfirmUtr(e.target.value)}
                  placeholder="e.g. KKBKR52026..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direct-confirm-notes">Notes (optional)</Label>
                <Input
                  id="direct-confirm-notes"
                  value={directConfirmNotes}
                  onChange={e => setDirectConfirmNotes(e.target.value)}
                  placeholder="Additional notes for the ledger entry"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDirectConfirmDialog(null)}>Cancel</Button>
              <Button
                onClick={() => directConfirmMutation.mutate({ pr: directConfirmDialog, date: directConfirmDate, utr: directConfirmUtr, notes: directConfirmNotes })}
                disabled={directConfirmMutation.isPending}
              >
                {directConfirmMutation.isPending ? "Saving..." : "Confirm & Save to Accounts"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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

  // Convert to array and sort alphabetically by vendor name
  const sortedVendors = Object.entries(vendorPayments).sort((a, b) => a[1].vendorName.localeCompare(b[1].vendorName));

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
