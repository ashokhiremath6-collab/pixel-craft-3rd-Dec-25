import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, User, FileText, Edit, Trash2, Building2, Send, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Vendor, VendorCategory } from "@shared/schema";
import { formatVendorNameWithCategory } from "@/lib/currencyUtils";
import InviteVendorDialog from "./InviteVendorDialog";

interface VendorCardProps {
  vendor: Vendor & { projects?: Array<{ projectId: string; projectName: string; clientName: string; status: string }> };
  categoryName?: string;
  onEdit?: (vendor: Vendor) => void;
  onDelete?: (vendorId: string) => void;
}

export default function VendorCard({ vendor, categoryName, onEdit, onDelete }: VendorCardProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const handleEdit = () => {
    onEdit?.(vendor);
  };

  const handleDelete = () => {
    onDelete?.(vendor.id);
  };

  return (
    <>
    <Card className="hover-elevate" data-testid={`card-vendor-${vendor.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-lg font-semibold" data-testid="text-vendor-name">
            {formatVendorNameWithCategory(vendor.name, categoryName)}
          </CardTitle>
          <Badge variant="secondary" className="mt-1" data-testid="badge-vendor-category">
            {categoryName || 'Unknown Category'}
          </Badge>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInviteOpen(true)}
            data-testid="button-invite-vendor"
            title="Invite this vendor to submit a quote via the portal"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Invite
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleEdit}
            data-testid="button-edit-vendor"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-menu-vendor">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
                data-testid="button-delete-vendor"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        {vendor.projects && vendor.projects.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Building2 className="h-4 w-4" />
              <span>Associated Projects</span>
            </div>
            <div className="space-y-1">
              {vendor.projects.map((project, index) => (
                <div key={project.projectId} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground" data-testid={`text-project-name-${index}`}>
                      {project.projectName}
                    </span>
                    <Badge variant={project.status === 'Selected' ? 'default' : 'secondary'} className="text-xs">
                      {project.status}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground" data-testid={`text-client-name-${index}`}>
                    {project.clientName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    <InviteVendorDialog vendor={vendor} open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}