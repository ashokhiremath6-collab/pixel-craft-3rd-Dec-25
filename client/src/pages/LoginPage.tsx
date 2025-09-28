import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { toast } = useToast();
  const { login, isLoginPending } = useAuth();

  // Mock Replit Auth data for development
  const handleReplitLogin = () => {
    const mockReplitData = {
      id: `replit-user-${Date.now()}`,
      email: "designer@replit.com",
      name: "Replit Designer",
      username: "replitdesigner",
      imageUrl: "https://storage.googleapis.com/replit/images/1669329104821_6e35d0fda9b88f77d6b60b85a25b5933.png"
    };

    login(mockReplitData);
  };

  // Effect to handle successful login
  useEffect(() => {
    // This will be called when login mutation succeeds
    // The useAuth hook handles the actual login flow
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Vendor Management</CardTitle>
          <CardDescription>
            Sign in with your Replit account to access the vendor management system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleReplitLogin}
            disabled={isLoginPending}
            className="w-full"
            data-testid="button-replit-login"
          >
            {isLoginPending ? "Signing in..." : "Sign in with Replit"}
          </Button>
          
          <p className="text-sm text-muted-foreground text-center">
            Secure authentication powered by Replit
          </p>
        </CardContent>
      </Card>
    </div>
  );
}