import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, User, FileText, Edit, Trash2 } from "lucide-react";
import type { Vendor } from "@shared/schema";

interface VendorCardProps {
  vendor: Vendor;
  onEdit?: (vendor: Vendor) => void;
  onDelete?: (vendorId: string) => void;
}

export default function VendorCard({ vendor, onEdit, onDelete }: VendorCardProps) {
  const handleEdit = () => {
    console.log('Edit vendor clicked:', vendor.id);
    onEdit?.(vendor);
  };

  const handleDelete = () => {
    console.log('Delete vendor clicked:', vendor.id);
    onDelete?.(vendor.id);
  };

  return (
    <Card className="hover-elevate" data-testid={`card-vendor-${vendor.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div className="flex-1">
          <CardTitle className="text-lg font-semibold" data-testid="text-vendor-name">
            {vendor.name}
          </CardTitle>
          <Badge variant="secondary" className="mt-1" data-testid="badge-vendor-category">
            {vendor.category}
          </Badge>
        </div>
        <div className="flex gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleEdit}
            data-testid="button-edit-vendor"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleDelete}
            data-testid="button-delete-vendor"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span data-testid="text-contact-person">{vendor.contactPerson}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span data-testid="text-phone">{vendor.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span data-testid="text-email">{vendor.email}</span>
        </div>
        {vendor.notes && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 mt-0.5" />
            <span data-testid="text-notes">{vendor.notes}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}