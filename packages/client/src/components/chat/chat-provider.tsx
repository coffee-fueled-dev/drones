"use client";

import { api } from "@drone/convex";
import { useMutation } from "convex/react";
import { type FunctionReference } from "convex/server";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useRouter, useSearchParams } from "next/navigation";
import {
  optimisticallySendMessage,
  useThreadMessages,
} from "@convex-dev/agent/react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { GenericId as Id } from "convex/values";
import { serializeForLLM } from "./util/serialize-for-llm";

// Extract the scheduleMessage parameters and pick only the optional ones for sendMessage
type ScheduleMessageArgs =
  typeof api.agent.public.mutations.scheduleMessage extends FunctionReference<
    "mutation",
    "public",
    infer Args,
    any
  >
    ? Args
    : never;
export type SendMessageOptions = Pick<ScheduleMessageArgs, "toolConfig"> & {
  context?: string | Record<string, unknown>;
};

interface ChatContextValue {
  chatContext?: string | Record<string, unknown>;
  profile:
    | {
        id: Id<"hardwareBrandProfiles">;
        type: "hardware-brand";
      }
    | {
        id: Id<"servicePartnerProfiles">;
        type: "service-partner";
      };
  threadId: string | null;
  isLoading: boolean;
  prompt: string;
  workosUserId: string | null;
  messages: ReturnType<typeof useThreadMessages>;
  resetThread: () => void;
  switchThread: (threadId: string) => void;
  setPrompt: (prompt: string) => void;
  sendMessage: (messagePrompt?: string, options?: SendMessageOptions) => void;
  abortStream: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

interface ChatProviderProps {
  chatContext?: string | Record<string, unknown>;
  profile:
    | {
        id: Id<"hardwareBrandProfiles">;
        type: "hardware-brand";
      }
    | {
        id: Id<"servicePartnerProfiles">;
        type: "service-partner";
      };
  toolConfig: SendMessageOptions["toolConfig"];
  children: ReactNode;
}

export function ChatProvider({
  profile,
  children,
  chatContext,
  toolConfig,
}: ChatProviderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const createThread = useMutation(api.agent.public.mutations.createNewThread);

  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  // Get thread ID from search params - this is the single source of truth
  const threadId = searchParams.get("thread");
  const workosUserId = user?.id ?? null;

  // Thread messages hook - only active when we have both threadId and workosUserId
  const messages = useThreadMessages(
    api.agent.public.queries.listMessages,
    threadId && workosUserId ? { threadId, workosUserId } : "skip",
    { initialNumItems: 10, stream: true }
  );

  // Send message mutation with optimistic updates
  const scheduleMessageMutation = useMutation(
    api.agent.public.mutations.scheduleMessage
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.agent.public.queries.listMessages)
  );

  // Abort stream mutation
  const abortStreamByOrder = useMutation(
    api.agent.public.mutations.abortStreamByOrder
  );

  const switchThread = useCallback(
    async (threadId: string) => {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("thread", threadId);
      router.replace(`?${newSearchParams.toString()}`);
    },
    [router, searchParams]
  );

  const resetThread = useCallback(async () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("thread");
    router.replace(`?${newSearchParams.toString()}`);
  }, [router, searchParams]);

  // This is for actually creating the thread on the server, which should happen
  // after the first message. Use resetThread to create a new thread from the UI
  const createNewThread = useCallback(
    async (initialMessage?: string, options?: SendMessageOptions) => {
      if (!user?.id) return;

      const collectedToolConfig = {
        ...toolConfig,
        ...options?.toolConfig,
      } as SendMessageOptions["toolConfig"];

      setIsLoading(true);
      try {
        const newThread = await createThread({
          profile,
          user: {
            externalId: user.id,
            email: user.email,
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
          },
          toolConfig: collectedToolConfig,
          initialMessage: initialMessage
            ? {
                prompt: initialMessage,
                context:
                  typeof chatContext === "string"
                    ? chatContext
                    : serializeForLLM(chatContext),
              }
            : undefined,
        });

        // Navigate to new thread
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set("thread", newThread.threadId);
        router.replace(`?${newSearchParams.toString()}`);
      } catch (error) {
        console.error("Failed to create thread:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [createThread, user, router, searchParams, profile]
  );

  // Send message function - creates thread if none exists
  const sendMessage = useCallback(
    async (messagePrompt?: string, options?: SendMessageOptions) => {
      const promptToSend = messagePrompt ?? prompt;
      if (promptToSend.trim() === "" || !workosUserId) return;

      const collectedToolConfig = {
        ...toolConfig,
        ...options?.toolConfig,
      } as SendMessageOptions["toolConfig"];

      // If no thread exists, create one first
      if (!threadId) {
        await createNewThread(promptToSend, {
          ...options,
          toolConfig: collectedToolConfig,
        });
        setPrompt("");
        return;
      }

      void scheduleMessageMutation({
        threadId,
        workosUserId,
        toolConfig: collectedToolConfig,
        prompt: promptToSend,
        context: getCombinedContext([chatContext, options?.context]),
      }).catch(() => setPrompt(promptToSend));
      setPrompt("");
    },
    [
      prompt,
      threadId,
      workosUserId,
      scheduleMessageMutation,
      toolConfig,
      createNewThread,
    ]
  );

  // Abort current stream
  const abortStream = useCallback(() => {
    if (!threadId || !workosUserId) return;
    const streamingMessage = messages.results?.find((m) => m.streaming);
    if (streamingMessage) {
      void abortStreamByOrder({
        threadId,
        order: streamingMessage.order,
        workosUserId,
      });
    }
  }, [threadId, workosUserId, messages.results, abortStreamByOrder]);

  // No automatic thread creation - threads are created when needed

  const value: ChatContextValue = {
    chatContext,
    profile,
    threadId,
    isLoading,
    workosUserId,
    messages,
    prompt,
    resetThread,
    switchThread,
    setPrompt,
    sendMessage,
    abortStream,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

const getCombinedContext = (
  chatContext?: (string | Record<string, unknown> | undefined)[]
) => {
  const combinedContext = chatContext
    ?.map((context) => {
      if (typeof context === "string") {
        return context;
      } else if (context) {
        return serializeForLLM(context);
      }
      return undefined;
    })
    .filter(Boolean)
    .join("\n\n");

  return (
    "Here is some general context about the conversation: " + combinedContext
  );
};
