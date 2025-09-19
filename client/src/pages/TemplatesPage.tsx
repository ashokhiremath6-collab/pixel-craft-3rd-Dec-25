import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, FileText, Download, Edit, Trash2 } from "lucide-react";

export default function TemplatesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Placeholder data - will be replaced with actual API calls
  const templates = [
    {
      id: "1",
      name: "Civil Work Quote Template",
      category: "Civil",
      description: "Standard template for civil construction quotes",
      isActive: true,
      lastModified: "2024-01-15",
    },
    {
      id: "2", 
      name: "Electrical Installation Template",
      category: "Electrical",
      description: "Template for electrical installation quotations",
      isActive: true,
      lastModified: "2024-01-12",
    },
    {
      id: "3",
      name: "HVAC System Quote",
      category: "HVAC", 
      description: "HVAC installation and maintenance quotes",
      isActive: false,
      lastModified: "2024-01-10",
    },
  ];

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" data-testid="templates-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-templates-title">
            Quote Templates
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage quote templates for different vendor categories
          </p>
        </div>
        <Button data-testid="button-add-template" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Template
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card 
            key={template.id} 
            className="hover-elevate transition-all duration-200"
            data-testid={`card-template-${template.id}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-template-name-${template.id}`}>
                      {template.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        data-testid={`badge-category-${template.id}`}
                      >
                        {template.category}
                      </Badge>
                      <Badge 
                        variant={template.isActive ? "default" : "destructive"}
                        className="text-xs"
                        data-testid={`badge-status-${template.id}`}
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="mb-4" data-testid={`text-description-${template.id}`}>
                {template.description}
              </CardDescription>
              
              <div className="text-xs text-muted-foreground mb-4" data-testid={`text-last-modified-${template.id}`}>
                Last modified: {template.lastModified}
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex items-center gap-1 flex-1"
                  data-testid={`button-download-${template.id}`}
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  data-testid={`button-edit-${template.id}`}
                  aria-label={`Edit ${template.name} template`}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  data-testid={`button-delete-${template.id}`}
                  aria-label={`Delete ${template.name} template`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-empty-state-heading">
            No templates found
          </h3>
          <p className="text-muted-foreground" data-testid="text-empty-state-message">
            {searchTerm ? "Try adjusting your search criteria" : "Create your first quote template to get started"}
          </p>
        </div>
      )}
    </div>
  );
}