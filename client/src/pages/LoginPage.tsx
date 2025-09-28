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
  const { login } = useAuth();

  // Real Replit Auth - redirect to /api/login
  const handleReplitLogin = () => {
    login(); // This redirects to /api/login for real authentication
  };

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
            className="w-full"
            data-testid="button-replit-login"
          >
            Sign in with Replit
          </Button>
          
          <p className="text-sm text-muted-foreground text-center">
            Secure authentication powered by Replit
          </p>
        </CardContent>
      </Card>
    </div>
  );
}