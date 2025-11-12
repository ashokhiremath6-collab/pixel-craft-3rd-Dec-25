import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { VendorCategory, WorksOrderTemplate, ProjectVendor } from "@shared/schema";
import { WizardStepCategory } from "./wizard-steps/WizardStepCategory";
import { WizardStepTemplate } from "./wizard-steps/WizardStepTemplate";
import { WizardStepQuote } from "./wizard-steps/WizardStepQuote";
import { WizardStepReview } from "./wizard-steps/WizardStepReview";

const worksOrderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),
  templateId: z.string().min(1, "Template is required"),
  projectVendorId: z.string().min(1, "Quote is required"),
  notes: z.string().optional(),
});

type WorksOrderFormData = z.infer<typeof worksOrderSchema>;

type WizardStep = "category" | "quote" | "template" | "review";

const STEPS: WizardStep[] = ["category", "quote", "template", "review"];

const STEP_LABELS: Record<WizardStep, string> = {
  category: "Category",
  quote: "Quote",
  template: "Covering Letter",
  review: "Review",
};

interface WorksOrderWizardProps {
  categories: VendorCategory[];
  templates: WorksOrderTemplate[];
  quotes: ProjectVendor[];
  onSubmit: (data: WorksOrderFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function WorksOrderWizard({
  categories,
  templates,
  quotes,
  onSubmit,
  onCancel,
  isSubmitting,
}: WorksOrderWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("category");

  const form = useForm<WorksOrderFormData>({
    resolver: zodResolver(worksOrderSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      templateId: "",
      projectVendorId: "",
      notes: "",
    },
    mode: "onChange",
  });

  // Auto-select first quote when category changes
  const categoryId = form.watch("categoryId");
  React.useEffect(() => {
    if (categoryId && categories.length > 0) {
      // Find the category name from categoryId
      const selectedCategory = categories.find(c => c.id === categoryId);
      if (selectedCategory) {
        // Filter quotes by category name (ProjectVendor has 'category' field, not 'categoryId')
        const quotesInCategory = quotes.filter(q => q.category === selectedCategory.name);
        if (quotesInCategory.length > 0 && !form.getValues("projectVendorId")) {
          form.setValue("projectVendorId", quotesInCategory[0].id);
        }
      }
    }
  }, [categoryId, categories, quotes, form]);

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const canGoNext = () => {
    const values = form.getValues();
    switch (currentStep) {
      case "category":
        return !!values.categoryId;
      case "quote":
        return !!values.projectVendorId;
      case "template":
        return !!values.templateId;
      case "review":
        return form.formState.isValid;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{STEP_LABELS[currentStep]}</span>
            <span>Step {currentStepIndex + 1} of {STEPS.length}</span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === "category" && <WizardStepCategory categories={categories} />}
          {currentStep === "quote" && (
            <WizardStepQuote 
              quotes={quotes}
              categoryId={form.watch("categoryId")}
              categories={categories}
            />
          )}
          {currentStep === "template" && <WizardStepTemplate templates={templates} />}
          {currentStep === "review" && <WizardStepReview />}
        </div>

        {/* Navigation */}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={currentStepIndex === 0 ? onCancel : handleBack}
            disabled={isSubmitting}
            data-testid="button-wizard-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {currentStepIndex === 0 ? "Cancel" : "Back"}
          </Button>

          {currentStep === "review" ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canGoNext() || isSubmitting}
              data-testid="button-wizard-submit"
            >
              {isSubmitting ? "Creating..." : "Create Works Order"}
              <Check className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext()}
              data-testid="button-wizard-next"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </div>
    </FormProvider>
  );
}
