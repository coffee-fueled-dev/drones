"use client";

import { Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipButton } from "@/components/tooltip-button";

export const CopyButton = ({ value }: { value: string }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy to clipboard", error);
    }
  };

  return (
    <TooltipButton tooltip="Copy" side="right">
      <Button onClick={handleCopy} variant="ghost" size="icon">
        <Clipboard size={16} />
        <span className="sr-only">Copy text</span>
      </Button>
    </TooltipButton>
  );
};
