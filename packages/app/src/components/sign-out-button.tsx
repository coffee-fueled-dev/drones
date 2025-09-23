"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const handleSignOut = async () => {
    try {
      const response = await fetch("/auth/sign-out", {
        method: "POST",
      });

      if (response.ok) {
        // Redirect will be handled by the server
        window.location.reload();
      }
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      className="flex items-center gap-2"
    >
      <LogOut size={16} />
      Sign Out
    </Button>
  );
}
