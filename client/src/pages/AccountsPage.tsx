import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, DollarSign, TrendingUp, Download, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      return await apiRequest('POST', `/api/vendors/${selectedVendorId}/invoices`, data);
    },
    onSuccess: () => {
      toast({
        title: "Invoice added",
        description: "The invoice has been successfully recorded.",
      });
      setAddInvoiceDialogOpen(false);
      invoiceForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/vendors', selectedVendorId, 'invoices'] });
    },
    onError: (error) => {
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
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to record payment",
        description: error.message,
      });
    },
  });

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Vendor Accounts</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Manage vendor invoices and payments
          </p>
        </div>
      </div>

      {/* Vendor Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Vendor</CardTitle>
          <CardDescription>Choose a vendor to view their ledger</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
            <SelectTrigger data-testid="select-vendor">
              <SelectValue placeholder="Select a vendor..." />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((vendor) => (
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
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-invoices">
                  ₹{totalInvoices.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">{invoices.length} invoice(s)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-payments">
                  ₹{totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">{payments.length} payment(s)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div 
                  className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-destructive' : 'text-green-600'}`}
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
                <Dialog open={addInvoiceDialogOpen} onOpenChange={setAddInvoiceDialogOpen}>
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

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setAddInvoiceDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addInvoiceMutation.isPending} data-testid="button-submit-invoice">
                        {addInvoiceMutation.isPending ? "Adding..." : "Add Invoice"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={addPaymentDialogOpen} onOpenChange={setAddPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-record-payment">
                  <DollarSign className="h-4 w-4 mr-2" />
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
                            <Textarea {...field} placeholder="Additional notes" data-testid="input-payment-notes" />
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

                <Button variant="outline" data-testid="button-export-ledger">
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
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit (₹)</TableHead>
                      <TableHead className="text-right">Credit (₹)</TableHead>
                      <TableHead className="text-right">Balance (₹)</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
