import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { VendorCategory, WorksOrderTemplate, ProjectVendor } from "@shared/schema";
import { WizardStepName } from "./wizard-steps/WizardStepName";
import { WizardStepCategory } from "./wizard-steps/WizardStepCategory";
import { WizardStepVendors } from "./wizard-steps/WizardStepVendors";
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

type WizardStep = "name" | "category" | "vendors" | "template" | "quote" | "review";

const STEPS: WizardStep[] = ["name", "category", "vendors", "template", "quote", "review"];

const STEP_LABELS: Record<WizardStep, string> = {
  name: "Name",
  category: "Category",
  vendors: "Vendors",
  template: "Template",
  quote: "Quote",
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
  const [currentStep, setCurrentStep] = useState<WizardStep>("name");

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

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const canGoNext = () => {
    const values = form.getValues();
    switch (currentStep) {
      case "name":
        return !!values.name;
      case "category":
        return !!values.categoryId;
      case "vendors":
        return true; // Read-only step
      case "template":
        return !!values.templateId;
      case "quote":
        return !!values.projectVendorId;
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
          {currentStep === "name" && <WizardStepName />}
          {currentStep === "category" && <WizardStepCategory categories={categories} />}
          {currentStep === "vendors" && <WizardStepVendors categoryId={form.watch("categoryId")} />}
          {currentStep === "template" && <WizardStepTemplate templates={templates} />}
          {currentStep === "quote" && (
            <WizardStepQuote 
              quotes={quotes}
              categoryId={form.watch("categoryId")}
            />
          )}
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
