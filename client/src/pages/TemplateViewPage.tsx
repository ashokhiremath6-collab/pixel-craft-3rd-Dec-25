import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Download, FileSpreadsheet } from "lucide-react";
import { Link } from "wouter";
import { QuoteTemplate } from "@shared/schema";
import { getTemplateDisplayName } from "@/lib/templateUtils";

export default function TemplateViewPage() {
  const { id } = useParams<{ id: string }>();

  const { data: template, isLoading, error } = useQuery<QuoteTemplate>({
    queryKey: ['/api/quote-templates', id],
    enabled: !!id
  });

  // Fetch categories to get category name for consistent naming
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/vendor-categories/tree'],
    enabled: !!template?.categoryId
  });

  // Find the category name for this template
  const getCategoryName = (categoryId: string, categories: any[]): string => {
    if (!Array.isArray(categories)) return '';
    for (const category of categories) {
      if (category.id === categoryId) return category.name;
      if (category.children) {
        const found = getCategoryName(categoryId, category.children);
        if (found) return found;
      }
    }
    return '';
  };

  const categoryName = template?.categoryId && Array.isArray(categories) 
    ? getCategoryName(template.categoryId, categories) 
    : '';
  const displayName = categoryName ? getTemplateDisplayName(template?.name || '', categoryName) : template?.name || '';

  // Handle Excel download
  const handleDownloadExcel = () => {
    if (!template) return;
    const downloadUrl = `/api/quote-templates/${template.id}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${displayName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading template...</p>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Template Not Found</h3>
          <p className="text-muted-foreground mb-4">The template you're looking for doesn't exist.</p>
          <Link href="/templates">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if this template has spreadsheet data
  const isSpreadsheetTemplate = template.fields && typeof template.fields === 'object' && 
    (template.fields as any).type === 'spreadsheet';
  
  // For legacy/non-spreadsheet templates
  const templateFields = !isSpreadsheetTemplate && template.fields ? 
    (Array.isArray(template.fields) ? template.fields : []) : [];
  const hasLegacyFields = Array.isArray(templateFields) && templateFields.length > 0;
  
  // Extract line items from spreadsheet data
  const getLineItems = () => {
    if (!isSpreadsheetTemplate || !(template.fields as any).data) {
      return [];
    }
    
    const data = (template.fields as any).data as any[][];
    
    if (data.length === 0) return [];
    
    // Simple middle-ground: Skip the first non-empty row (usually main header) and show rest
    let firstNonEmptyRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 0 && row.some(cell => cell && String(cell).trim())) {
        firstNonEmptyRowIndex = i;
        break;
      }
    }
    
    // Start from the row after the first non-empty row
    const startIndex = firstNonEmptyRowIndex >= 0 ? firstNonEmptyRowIndex + 1 : 0;
    
    return data
      .slice(startIndex)
      .map((row, index) => {
        // Skip completely empty rows
        if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
          return null;
        }
        
        // Find first non-empty cell as description
        const descriptionIndex = row.findIndex(cell => cell && String(cell).trim());
        if (descriptionIndex < 0) return null;
        
        const description = String(row[descriptionIndex]);
        
        // Get remaining cells as details
        const details = row
          .slice(descriptionIndex + 1)
          .filter(cell => cell && String(cell).trim())
          .map(cell => String(cell))
          .join(' | ');
        
        return {
          id: index,
          description,
          details
        };
      })
      .filter((item): item is { id: number; description: string; details: string } => 
        item !== null && item.description.trim() !== ''
      );
  };

  const lineItems = getLineItems();
  const hasSpreadsheetData = lineItems.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/templates">
            <Button variant="outline" size="sm" data-testid="button-back-to-templates">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Templates
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-template-name">
              {displayName}
            </h1>
            <p className="text-muted-foreground">
              Template Details and Content
            </p>
          </div>
        </div>
        <Badge variant={template.isActive ? "default" : "secondary"}>
          {template.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Template Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                {isSpreadsheetTemplate ? 'Template Fields' : 'Template Fields'}
                {hasSpreadsheetData && (
                  <Badge variant="secondary" className="text-xs">
                    {lineItems.length} line items
                  </Badge>
                )}
                {hasLegacyFields && (
                  <Badge variant="secondary" className="text-xs">
                    {templateFields.length} fields
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {hasSpreadsheetData ? 'Standard Line Items' : (template.description || 'Template line items and content')}
              </CardDescription>
            </div>
            {(hasSpreadsheetData || hasLegacyFields) ? (
              <Button 
                variant="default"
                onClick={handleDownloadExcel}
                data-testid="button-open-in-excel"
              >
                <Download className="h-4 w-4 mr-2" />
                Open in Excel
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {/* Spreadsheet Template - List Format */}
          {isSpreadsheetTemplate && hasSpreadsheetData && (
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div 
                  key={item.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover-elevate"
                  data-testid={`line-item-${index}`}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base mb-1" data-testid={`item-description-${index}`}>
                      {item.description}
                    </h3>
                    {item.details && (
                      <p className="text-sm text-muted-foreground" data-testid={`item-details-${index}`}>
                        {item.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Legacy Template - Field Table Format */}
          {!isSpreadsheetTemplate && hasLegacyFields && (
            <div className="border rounded-lg">
              <Table>
                <TableBody>
                  {templateFields.map((field: any, index: number) => (
                    <TableRow key={index} data-testid={`template-field-${index}`}>
                      <TableCell className="font-medium">
                        {field.name || field.fieldName || `Field ${index + 1}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {field.type || field.fieldType || 'Text'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={field.required ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {field.required ? 'Required' : 'Optional'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {field.description || 'No description'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Empty State - but if template has original file, show Excel button prominently */}
          {!hasSpreadsheetData && !hasLegacyFields && (
            <div className="flex justify-center py-6">
              <div className="text-center w-1/2">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-primary opacity-70" />
                <h3 className="text-base font-medium mb-1">View Template in Excel</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {template.originalFileName 
                    ? "This template is best viewed in Excel for proper formatting and full content." 
                    : "This template doesn't have any data to preview."}
                </p>
                <Button 
                  variant="default"
                  onClick={handleDownloadExcel}
                  data-testid="button-download-empty-template"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Open in Excel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
