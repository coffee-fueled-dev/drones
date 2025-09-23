"use client";

import { Button } from "@/components/ui/button";
import { ScrollBar } from "@/components/ui/scroll-area";
import { TooltipButton } from "@/components/tooltip-button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FolderClock, Plus } from "lucide-react";
import { useChat } from "./chat-provider";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { ScrollArea } from "@/components/ui/scroll-area";

export const PreviousThreads = () => {
  const { switchThread, resetThread } = useChat();
  const { user } = useAuth();
  const threads = useQuery(
    api.agent.operations.queries.thread.listThreadsByUser,
    {
      workosUserId: user?.id ?? "",
    }
  );

  return (
    <Sheet>
      <TooltipButton tooltip="Chat History" side="right">
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <FolderClock size={16} />
          </Button>
        </SheetTrigger>
      </TooltipButton>
      <SheetContent className="gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>Chat History</SheetTitle>
          <SheetDescription className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              Select a previous chat to continue the conversation.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="p-0"
              onClick={() => resetThread()}
            >
              New Chat <Plus size={16} />
            </Button>
          </SheetDescription>
        </SheetHeader>
        <div className="h-full">
          <ScrollArea className="h-full">
            <div className="h-36">
              {threads?.map((thread) => (
                <div key={thread._id}>
                  <Button
                    variant="link"
                    onClick={() => switchThread(thread._id)}
                    className="w-full justify-start"
                  >
                    {thread.title ||
                      new Date(thread._creationTime).toLocaleDateString()}
                  </Button>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>
        <SheetFooter className="border-t">
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
