"use client";

import { Prompt } from "./prompt";
import { Loader2 } from "lucide-react";
import { useChat } from "@/components/chat/chat-provider";
import { FC, ReactNode } from "react";
import { PreviousThreads } from "./previous-threads";
import { Messages } from "./messages/messages";

export const Chat: FC<{ children?: ReactNode }> = ({ children }) => {
  const { workosUserId } = useChat();

  if (!workosUserId) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="animate-spin" size={16} />
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className="h-full flex flex-col flex-1">
        <div className="flex flex-1 h-full w-full">
          <div className="p-4 flex-shrink-0">
            <PreviousThreads />
          </div>
          <div className="flex-1">
            <Messages>{children}</Messages>
          </div>
        </div>
        <div
          className="flex-shrink-0 w-full border-t py-6 flex"
          style={{ paddingLeft: 68, paddingRight: 24 }}
        >
          <Prompt />
        </div>
      </div>
      <div className="flex-0" />
    </div>
  );
};
