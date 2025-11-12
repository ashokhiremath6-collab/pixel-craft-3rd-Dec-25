import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Phone, User } from "lucide-react";
import type { Vendor } from "@shared/schema";

interface WizardStepVendorsProps {
  categoryId: string;
}

export function WizardStepVendors({ categoryId }: WizardStepVendorsProps) {
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const filteredVendors = vendors.filter((v) => v.categoryId === categoryId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Matching Vendors</h3>
        <p className="text-sm text-muted-foreground">
          {filteredVendors.length > 0
            ? `Found ${filteredVendors.length} vendor${filteredVendors.length !== 1 ? 's' : ''} in this category.`
            : "No vendors found in this category."}
        </p>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredVendors.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8 text-center">
              <div className="space-y-2">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No vendors available in this category.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredVendors.map((vendor) => (
            <Card key={vendor.id} data-testid={`card-vendor-${vendor.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-medium">{vendor.name}</h4>
                    {vendor.contactPerson && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-3 h-3" />
                        {vendor.contactPerson}
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {vendor.phone}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
