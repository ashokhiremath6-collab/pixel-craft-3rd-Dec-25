import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-settings">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Configure your vendor management system preferences
        </p>
      </div>

      <Card className="text-center py-12">
        <CardContent>
          <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground" data-testid="text-settings-placeholder">
            Settings panel will be implemented in the full application.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Features like user preferences, system configuration, and data export options will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}