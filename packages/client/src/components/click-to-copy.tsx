"use client";

import { Button } from "./common";
import { ClipboardIcon } from "lucide-react";
import { FC, ReactNode, useState } from "react";
import { cn } from "./lib/utils";
import { TooltipButton } from "./tooltip-button";
import { TooltipContentProps } from "@radix-ui/react-tooltip";

export const ClickToCopy: FC<{
  value: string;
  children: ReactNode;
  className?: string;
  tooltip?: string;
  side?: TooltipContentProps["side"];
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}> = ({ value, children, className, tooltip, side, onError, onSuccess }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to copy to clipboard", error);
      onError?.(error as Error);
    }
  };

  return (
    <TooltipButton
      tooltip={tooltip || "Copy to clipboard"}
      side={side ?? "right"}
    >
      <Button
        variant="ghost"
        className={cn("flex justify-between", className)}
        onClick={handleCopy}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
      >
        <span>{children}</span>
        <ClipboardIcon
          size={16}
          className={isHovered ? "opacity-100" : "opacity-0"}
        />
      </Button>
    </TooltipButton>
  );
};
