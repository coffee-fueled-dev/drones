import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { components } from "../../_generated/api";

export const updateThreadTitle = createTool({
  args: z.object({
    title: z.string().describe("A new three word title for the thread"),
  }),
  description:
    "Update the title of the current thread. " +
    "Use this tool when the conversation has a clear topic that should be reflected in the title.",
  handler: async (ctx, args) => {
    if (!ctx.threadId) {
      console.warn("updateThreadTitle called without a threadId");
      return "missing or invalid threadId";
    }
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId: ctx.threadId,
      patch: { title: args.title },
    });
    return "updated";
  },
});
