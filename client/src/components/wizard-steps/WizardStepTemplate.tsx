import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Download, Upload, Loader2 } from "lucide-react";
import type { WorksOrderDocument } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WizardStepTemplateProps {
  templates: WorksOrderDocument[];
}

export function WizardStepTemplate({ templates }: WizardStepTemplateProps) {
  const form = useFormContext();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('version', '1.0');
      
      const response = await fetch('/api/works-order-templates', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data: WorksOrderDocument) => {
      queryClient.invalidateQueries({ queryKey: ['/api/works-order-templates'] });
      form.setValue('templateId', data.id);
      toast({
        title: "Template uploaded",
        description: "Your template has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload template",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      toast({
        title: "Invalid file",
        description: "Please upload a .docx file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (templateId: string, fileName: string) => {
    const downloadUrl = `/api/works-order-templates/${templateId}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Select Template</h3>
        <p className="text-sm text-muted-foreground">
          Choose an existing template or upload a new one.
        </p>
      </div>

      <FormField
        control={form.control}
        name="templateId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Available Templates</FormLabel>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange}>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {templates.map((template) => (
                    <Card
                      key={template.id}
                      className={field.value === template.id ? "border-primary" : ""}
                      data-testid={`card-template-${template.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={template.id} id={template.id} />
                          <div className="flex-1">
                            <label
                              htmlFor={template.id}
                              className="flex items-start justify-between cursor-pointer"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-primary" />
                                  <span className="font-medium">{template.fileName}</span>
                                </div>
                                {template.version && (
                                  <p className="text-xs text-muted-foreground">
                                    Version {template.version}
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDownload(template.id, template.fileName);
                                }}
                                data-testid={`button-download-template-${template.id}`}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Upload New Template */}
      <div className="border-t pt-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Upload New Template</h4>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              disabled={isUploading}
              data-testid="input-upload-template"
              className="flex-1"
            />
            {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Upload a .docx template file
          </p>
        </div>
      </div>
    </div>
  );
}
