import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export const ToolInvocationPart = ({
  args,
  toolName,
  result,
  state,
  toolCallId,
}: {
  args: Record<
    string,
    string | boolean | number | (string | number | boolean)[]
  >;
  result: string;
  toolName: string;
  state: "result" | "partial-call" | "call";
  toolCallId: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="flex w-full flex-col p-4 rounded-md border"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex gap-2 items-center">
          {state === "result" && <Check size={10} />}
          <h4 className="text-xs font-semibold">{toolName}</h4>
          <i className="text-xs">{toolCallId}</i>
        </span>

        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <ChevronsUpDown />
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="grid grid-cols-[1fr] gap-2 mt-2">
          <JSONElement data={args} title="Arguments" />
          {result && <JSONElement data={result} title="Result" />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const JSONElement = ({ data, title }: { data: unknown; title: string }) => {
  return (
    <ScrollArea className="min-w-0 rounded-md border">
      <div>
        <h5 className="px-4 text-xs text-muted-foreground border-b py-2">
          {title}
        </h5>
        <pre className="font-mono text-xs px-4 py-2">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
