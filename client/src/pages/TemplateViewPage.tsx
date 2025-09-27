import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Activity, Calendar, User, MoreHorizontal, Download } from "lucide-react";
import { Link } from "wouter";
import { QuoteTemplate } from "@shared/schema";

export default function TemplateViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: template, isLoading, error } = useQuery<QuoteTemplate>({
    queryKey: ['/api/quote-templates', id],
    enabled: !!id
  });

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
              {template.name}
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
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Template Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Template Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-sm mt-1" data-testid="text-template-name">{template.name}</p>
            </div>
            
            {template.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm mt-1" data-testid="text-template-description">{template.description}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge variant={template.isActive ? "default" : "secondary"} className="text-xs">
                  {template.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>

            {template.createdAt && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p className="text-sm mt-1 flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {new Date(template.createdAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Excel Spreadsheet Data - Full Width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Excel Data
{isSpreadsheetTemplate && (
                <Badge variant="secondary" className="text-xs">
                  {(template.fields as any).rowCount || 0} rows × {(template.fields as any).columnCount || 0} columns
                </Badge>
              )}
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
                            className={`p-3 border-r border-b font-mono whitespace-nowrap ${
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
    </div>
  );
}