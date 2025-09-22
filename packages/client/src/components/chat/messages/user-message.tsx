import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export const UserMessage = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex justify-end flex-1 w-full">
      <Card className="rounded-lg border-0 py-2 bg-primary text-primary-foreground max-w-96">
        <CardContent className="px-4 tracking-wide">
          <ScrollArea className="h-full">
            {children}
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
