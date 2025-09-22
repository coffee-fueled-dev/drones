"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@/components/chat/chat-provider";
import { FC } from "react";
import { Send, Square } from "lucide-react";

export const Prompt: FC<{ placeholder?: string }> = ({ placeholder }) => {
  const { messages, setPrompt, prompt, sendMessage, abortStream } = useChat();

  function onSendClicked() {
    sendMessage();
  }

  return (
    <form
      className="flex w-full justify-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSendClicked();
      }}
    >
      <div className="flex-1" style={{ maxWidth: 800 }}>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              (e.metaKey || e.ctrlKey) &&
              prompt.trim()
            ) {
              e.preventDefault();
              onSendClicked();
            }
          }}
          placeholder={placeholder || "Ask a question about this company..."}
        />
      </div>
      {messages.results?.find((m) => m.streaming) ? (
        <Button
          variant="default"
          onClick={abortStream}
          type="button"
          size="icon"
        >
          <Square size={24} />
        </Button>
      ) : (
        <Button
          type="submit"
          variant="default"
          size="icon"
          disabled={!prompt.trim()}
        >
          <Send size={24} />
        </Button>
      )}
    </form>
  );
};
