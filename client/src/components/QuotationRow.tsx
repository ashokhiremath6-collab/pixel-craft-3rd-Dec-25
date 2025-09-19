import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "./StatusBadge";
import { FileText, Download, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface QuotationRowProps {
  quotation: QuotationData;
  onStatusChange?: (id: string, status: "Quoted" | "Selected" | "Rejected") => void;
  onDownload?: (file: string) => void;
}

export default function QuotationRow({ quotation, onStatusChange, onDownload }: QuotationRowProps) {
  const handleStatusChange = (newStatus: "Quoted" | "Selected" | "Rejected") => {
    console.log('Status change:', quotation.id, newStatus);
    onStatusChange?.(quotation.id, newStatus);
  };

  const handleDownload = () => {
    if (quotation.quotationFile) {
      console.log('Download file:', quotation.quotationFile);
      onDownload?.(quotation.quotationFile);
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(parseFloat(value));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <TableRow 
      className={cn(
        "hover-elevate",
        quotation.status === "Selected" && "bg-green-50 dark:bg-green-900/10"
      )}
      data-testid={`row-quotation-${quotation.id}`}
    >
      <TableCell className="font-medium" data-testid="text-vendor-name">
        <div className="flex flex-col">
          <span>{quotation.vendorName}</span>
          <Badge variant="outline" className="w-fit mt-1">
            {quotation.category}
          </Badge>
        </div>
      </TableCell>
      
      <TableCell data-testid="text-quotation-value">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">
            {formatCurrency(quotation.quotationValue)}
          </span>
          {quotation.isAboveAverage && (
            <AlertTriangle className="h-4 w-4 text-orange-500" data-testid="icon-above-average" />
          )}
        </div>
      </TableCell>
      
      <TableCell data-testid="text-quotation-date">
        {formatDate(quotation.dateOfQuotation)}
      </TableCell>
      
      <TableCell data-testid="cell-status">
        <div className="flex items-center gap-2">
          <StatusBadge status={quotation.status} />
          <div className="flex gap-1">
            {quotation.status !== "Selected" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("Selected")}
                data-testid="button-select-vendor"
              >
                Select
              </Button>
            )}
            {quotation.status !== "Rejected" && quotation.status !== "Selected" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("Rejected")}
                data-testid="button-reject-vendor"
              >
                Reject
              </Button>
            )}
          </div>
        </div>
      </TableCell>
      
      <TableCell data-testid="cell-actions">
        <div className="flex items-center gap-2">
          {quotation.quotationFile && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDownload}
              data-testid="button-download-file"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {quotation.notes && (
            <Button
              size="icon"
              variant="ghost"
              data-testid="button-view-notes"
            >
              <FileText className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}