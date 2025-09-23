import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./common";
import { FC, ReactNode } from "react";
import { TooltipContentProps, TooltipProps } from "@radix-ui/react-tooltip";

export const TooltipButton: FC<
  {
    children?: ReactNode;
    tooltip: string;
    side?: TooltipContentProps["side"];
  } & TooltipProps
> = ({ children, tooltip, side, ...props }) => (
  <TooltipProvider>
    <Tooltip {...props}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
