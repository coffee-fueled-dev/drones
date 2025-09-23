"use client";

import { toUIMessages, UIMessage } from "@convex-dev/agent/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FC, ReactNode, useEffect, useRef, useState } from "react";
import { useChat } from "@/components/chat/chat-provider";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Messages: FC<{ children?: ReactNode }> = ({ children }) => {
  const { messages } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState<number>(400);

  const scrollToBottom = () =>
    messagesContainerRef.current?.scrollIntoView(false);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        setScrollAreaHeight(Math.max(200, containerHeight)); // Minimum 200px
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    scrollToBottom(); // Scroll on initial load
  }, []);

  return (
    <div className="h-full" ref={containerRef}>
      {messages.results?.length > 0 ? (
        <ScrollArea
          ref={scrollAreaRef}
          style={{
            height: `${scrollAreaHeight}px`,
          }}
        >
          <div className="flex justify-center" ref={messagesContainerRef}>
            <div
              className={cn("flex flex-col flex-1 gap-4", "py-6")}
              style={{ maxWidth: 800, paddingRight: 68 }}
            >
              {messages.results.length >= 5 && (
                <Button variant="link" onClick={() => messages.loadMore(10)}>
                  {messages.isLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Load More"
                  )}
                </Button>
              )}
              {toUIMessages(messages.results ?? []).map((m) => (
                <Message key={m.key} message={m} />
              ))}
            </div>
          </div>
        </ScrollArea>
      ) : (
        <div className="h-full flex flex-col items-center justify-center">
          <div style={{ minWidth: 800 }}>{children}</div>
        </div>
      )}
    </div>
  );
};

const Message = ({ message }: { message: UIMessage }) =>
  message.status === "pending" ? (
    <div className="flex items-center justify-center w-full h-full">
      <Loader2 className="animate-spin" size={16} />
    </div>
  ) : message.role === "user" ? (
    <UserMessage>{message.text}</UserMessage>
  ) : (
    <AssistantMessage message={message} />
  );
