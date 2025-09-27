import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Activity, Calendar, User, MoreHorizontal, Download } from "lucide-react";
import { Link } from "wouter";
import { QuoteTemplate } from "@shared/schema";
import { getTemplateDisplayName } from "@/lib/templateUtils";

export default function TemplateViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

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

  // Handle different field formats
  const isSpreadsheetTemplate = template.fields && typeof template.fields === 'object' && 
    (template.fields as any).type === 'spreadsheet';
  const templateFields = !isSpreadsheetTemplate && template.fields ? 
    JSON.parse(JSON.stringify(template.fields)) : [];
  const hasFields = Array.isArray(templateFields) && templateFields.length > 0;

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
        <div className="flex items-center gap-2">
          <Badge variant={template.isActive ? "default" : "secondary"}>
            {template.isActive ? "Active" : "Inactive"}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Download Excel file to open in Excel application
              const downloadUrl = `/api/quote-templates/${template.id}/download`;
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.download = `${displayName}.xlsx`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            data-testid="button-download-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            Open in Excel
          </Button>
        </div>
      </div>

      {/* Excel Spreadsheet Data - Full Width */}
      <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Excel Data
              {isSpreadsheetTemplate ? (
                <Badge variant="secondary" className="text-xs">
                  {(template.fields as any).rowCount || 0} rows × {(template.fields as any).columnCount || 0} columns
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Original Excel file content displayed in spreadsheet format
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSpreadsheetTemplate && (template.fields as any).data ? (
              <div className="border rounded-lg overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                <Table className="text-xs">
                  <TableBody>
                    {((template.fields as any).data as any[][]).map((row: any[], rowIndex: number) => (
                      <TableRow key={rowIndex} data-testid={`excel-row-${rowIndex}`}>
                        {row.map((cell: any, colIndex: number) => (
                          <TableCell 
                            key={colIndex} 
                            className={`p-3 border-r border-b font-mono break-words max-w-xs ${
                              rowIndex === 0 ? 'font-bold bg-muted text-sm' : 
                              rowIndex === 1 ? 'font-semibold bg-muted/50 text-sm' : 'text-xs'
                            }`}
                            data-testid={`excel-cell-${rowIndex}-${colIndex}`}
                          >
                            {String(cell || '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : hasFields ? (
              // Fallback to old field format if not spreadsheet type
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
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Data Available</h3>
                <p className="text-sm">
                  This template doesn't have any Excel data or field definitions.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}