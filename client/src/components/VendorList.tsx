import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import VendorCard from "./VendorCard";
import { Search, Plus, Filter } from "lucide-react";
import type { Vendor } from "@shared/schema";

interface VendorListProps {
  vendors: Vendor[];
  onAddVendor?: () => void;
  onEditVendor?: (vendor: Vendor) => void;
  onDeleteVendor?: (vendorId: string) => void;
}

export default function VendorList({ vendors, onAddVendor, onEditVendor, onDeleteVendor }: VendorListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    console.log('Search term:', value);
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    console.log('Filter by category:', category);
  };

  const handleAddVendor = () => {
    console.log('Add vendor clicked');
    onAddVendor?.();
  };

  // Get unique categories
  const categories = Array.from(new Set(vendors.map(v => v.category)));

  // Filter vendors
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || vendor.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group vendors by category
  const vendorsByCategory = filteredVendors.reduce((acc, vendor) => {
    if (!acc[vendor.category]) {
      acc[vendor.category] = [];
    }
    acc[vendor.category].push(vendor);
    return acc;
  }, {} as Record<string, Vendor[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-vendors">Vendors</h1>
          <p className="text-muted-foreground">
            Manage your vendor database by category
          </p>
        </div>
        <Button onClick={handleAddVendor} data-testid="button-add-vendor">
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors or contacts..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-vendors"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span data-testid="text-results-count">
          {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} found
        </span>
        {selectedCategory !== "all" && (
          <Badge variant="secondary" data-testid="badge-active-filter">
            {selectedCategory}
          </Badge>
        )}
      </div>

      {/* Vendors by Category */}
      {Object.entries(vendorsByCategory).map(([category, categoryVendors]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold" data-testid={`heading-category-${category}`}>
              {category}
            </h2>
            <Badge variant="outline" data-testid={`badge-category-count-${category}`}>
              {categoryVendors.length} vendor{categoryVendors.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryVendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                onEdit={onEditVendor}
                onDelete={onDeleteVendor}
              />
            ))}
          </div>
        </div>
      ))}

      {filteredVendors.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground" data-testid="text-no-vendors">
              No vendors found matching your criteria.
            </p>
            <Button 
              variant="outline" 
              onClick={handleAddVendor}
              className="mt-4"
              data-testid="button-add-first-vendor"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Vendor
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}