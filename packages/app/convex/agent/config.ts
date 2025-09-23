import { chat, textEmbedding } from "./models";
import { searchThreadMessages, updateThreadTitle } from "./tools";

export const defaultConfig = {
  chat,
  textEmbedding,
  tools: {
    ["Search messages in the thread"]: searchThreadMessages,
    ["Update the thread title"]: updateThreadTitle,
  },
  instructions:
    "You are an expert advisor on drone regulation in the united states. " +
    "You should use the tools available to you to consult operators on their obligations with regard todrone regulations.",
  // Used for fetching context messages. See https://docs.convex.dev/agents/context
  contextOptions: {},
  // Used for storing messages. See https://docs.convex.dev/agents/messages
  storageOptions: {
    saveMessages: "all",
  },
  // Used for limiting the number of steps when tool calls are involved.
  // NOTE: if you want tool calls to happen automatically with a single call,
  // you need to set this to something greater than 1 (the default).
  maxSteps: 10,
  // Used for limiting the number of retries when a tool call fails. Default: 3.
  maxRetries: 3,
  // Used for tracking token usage. See https://docs.convex.dev/agents/usage-tracking
  // usageHandler: async (ctx, { model, usage }) => {
  //   // ... log, save usage to your database, etc.
  // },
} as const;
