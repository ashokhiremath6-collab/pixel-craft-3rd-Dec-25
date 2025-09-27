import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Calendar, Tag, Activity } from "lucide-react";
import type { QuoteTemplate } from "@shared/schema";

interface TemplateViewDialogProps {
  template: QuoteTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateViewDialog({ template, open, onOpenChange }: TemplateViewDialogProps) {
  if (!template) return null;

  // Handle different field formats
  const isSpreadsheetTemplate = template.fields && typeof template.fields === 'object' && 
    (template.fields as any).type === 'spreadsheet';
  const templateFields = !isSpreadsheetTemplate && template.fields ? 
    JSON.parse(JSON.stringify(template.fields)) : [];
  const hasFields = Array.isArray(templateFields) && templateFields.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {template.name}
          </DialogTitle>
          <DialogDescription>
            View template details and field structure
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto pr-6">
          <div className="space-y-6">
            {/* Template Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Template Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-sm font-medium" data-testid="template-view-name">{template.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge 
                        variant={template.isActive ? "default" : "destructive"}
                        className="text-xs"
                        data-testid="template-view-status"
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="text-sm" data-testid="template-view-description">
                      {template.description || "No description provided"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs" data-testid="template-view-created">
                        {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Excel Spreadsheet Data */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Excel Data
                  {isSpreadsheetTemplate && (
                    <Badge variant="secondary" className="text-xs">
                      {(template.fields as any).rowCount} rows × {(template.fields as any).columnCount} columns
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Original Excel file content displayed in spreadsheet format
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isSpreadsheetTemplate && (template.fields as any).data ? (
                  <div className="border rounded-lg overflow-auto max-h-96">
                    <Table className="text-xs">
                      <TableBody>
                        {((template.fields as any).data as any[][]).map((row: any[], rowIndex: number) => (
                          <TableRow key={rowIndex} data-testid={`excel-row-${rowIndex}`}>
                            {row.map((cell: any, colIndex: number) => (
                              <TableCell 
                                key={colIndex} 
                                className={`p-2 border-r border-b font-mono ${
                                  rowIndex === 0 ? 'font-bold bg-muted' : 
                                  rowIndex === 1 ? 'font-semibold bg-muted/50' : ''
                                }`}
                                data-testid={`excel-cell-${rowIndex}-${colIndex}`}
                              >
                                {cell || ''}
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
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Required</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
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
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Data Available</h3>
                    <p className="text-sm">
                      This template doesn't have any Excel data or field definitions.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template File Info (if exists) */}
            {template.templateFile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Template File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="template-file-path">
                      {template.templateFile}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}